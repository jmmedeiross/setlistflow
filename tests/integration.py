"""HTTP/SQLite integration tests; temporary database, no external services."""
import copy, json, os, pathlib, socket, subprocess, tempfile, time, unittest, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
ROOT = pathlib.Path(__file__).resolve().parents[1]
DLL = pathlib.Path(os.environ.get('SETLISTFLOW_TEST_DLL', ROOT / 'src/SetlistFlow.Api/bin/Release/net10.0/SetlistFlow.Api.dll'))
DOTNET = os.environ.get('DOTNET_EXE', 'dotnet')

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0)); cls.port = s.getsockname()[1]
        cls.url = 'http://127.0.0.1:' + str(cls.port)
        cls.start()
    @classmethod
    def start(cls, readonly=False):
        env = dict(os.environ, ASPNETCORE_URLS=cls.url, SETLISTFLOW_DB=str(pathlib.Path(cls.temp.name)/'test.db'), SETLISTFLOW_READ_ONLY=str(readonly).lower())
        cls.process = subprocess.Popen([DOTNET, str(DLL)], cwd=str(ROOT/'src/SetlistFlow.Api'), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                if cls.request('/health')[0] == 200: return
            except (OSError, urllib.error.URLError): pass
            if cls.process.poll() is not None: raise RuntimeError('Application exited during startup')
            time.sleep(.1)
        raise RuntimeError('Application failed to start')
    @classmethod
    def stop(cls):
        cls.process.terminate(); cls.process.wait(timeout=10)
    @classmethod
    def tearDownClass(cls):
        cls.stop(); cls.temp.cleanup()
    @classmethod
    def request(cls, path, method='GET', body=None):
        req = urllib.request.Request(cls.url+'/api'+path, data=None if body is None else json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method=method)
        try: response = urllib.request.urlopen(req, timeout=12)
        except urllib.error.HTTPError as e: response = e
        raw = response.read()
        return response.code, json.loads(raw) if raw else None
    def plan(self, duration=100, pause=0):
        t = self.request('/tracks')[1][0]
        return {'name':'Teste fictício','limitSeconds':1200,'marginSeconds':120,'items':[{'entryId':'entry','trackId':t['id'],'title':t['title'],'album':t['album'],'studioSeconds':t['studioSeconds'],'liveSeconds':duration,'introSeconds':0,'pauseSeconds':pause,'energy':'','cue':'Sinal de demonstração'}]}
    def create(self, plan=None):
        status, show = self.request('/shows','POST',plan or self.plan())
        self.assertEqual(201,status); return show
    def test_01_seed_and_health(self):
        self.assertEqual(200,self.request('/health')[0]); self.assertEqual(6,len(self.request('/tracks')[1]))
    def test_02_save_revision_preserves_approval(self):
        s=self.create(); status, approved=self.request('/shows/'+s['id']+'/approve','POST',{'expectedVersion':s['version']}); self.assertEqual(200,status)
        plan=copy.deepcopy(approved['draft']['plan']); plan['items'][0]['liveSeconds']=200;plan['items'][0]['cue']='Novo rascunho'
        status, edited=self.request('/shows/'+s['id'],'PUT',{'expectedVersion':approved['version'],'plan':plan})
        self.assertEqual(200,status);self.assertEqual(100,edited['approved']['plan']['items'][0]['liveSeconds']);self.assertEqual(200,edited['draft']['plan']['items'][0]['liveSeconds']);self.assertEqual(2,len(edited['history']))
    def test_03_stale_save_and_approval_conflict(self):
        s=self.create();payload={'expectedVersion':s['version'],'plan':s['draft']['plan']}
        self.assertEqual(200,self.request('/shows/'+s['id'],'PUT',payload)[0]);self.assertEqual(409,self.request('/shows/'+s['id'],'PUT',payload)[0]);self.assertEqual(409,self.request('/shows/'+s['id']+'/approve','POST',{'expectedVersion':s['version']})[0])
    def test_04_over_budget_cannot_approve(self):
        s=self.create(self.plan(duration=1100));self.assertEqual(400,self.request('/shows/'+s['id']+'/approve','POST',{'expectedVersion':1})[0])
    def test_05_catalog_deletion_keeps_snapshot(self):
        status,t=self.request('/tracks','POST',{'title':'Faixa de teste','album':'Fictício','studioSeconds':90,'sourceUrl':''});self.assertEqual(201,status)
        plan=self.plan();plan['items'][0].update(trackId=t['id'],title=t['title'],studioSeconds=90,album=t['album'])
        s=self.create(plan);self.request('/shows/'+s['id']+'/approve','POST',{'expectedVersion':1});self.assertEqual(204,self.request('/tracks/'+t['id'],'DELETE')[0])
        snapshot=self.request('/shows/'+s['id'])[1];self.assertEqual(t['title'],snapshot['approved']['plan']['items'][0]['title'])
    def test_06_tampered_metadata_normalized(self):
        p=self.plan();p['items'][0]['title']='Alterado no cliente';p['items'][0]['studioSeconds']=1
        s=self.create(p);self.assertNotEqual('Alterado no cliente',s['draft']['plan']['items'][0]['title']);self.assertGreater(s['draft']['plan']['items'][0]['studioSeconds'],1)
    def test_07_invalid_and_missing(self):
        p=self.plan();p['items'][0]['pauseSeconds']=-1;self.assertEqual(400,self.request('/shows','POST',p)[0]);self.assertEqual(404,self.request('/shows/missing')[0])
        p=self.plan();p['items']=[None];self.assertEqual(400,self.request('/shows','POST',p)[0])
        self.assertEqual(400,self.request('/tracks','POST',{'title':None,'album':None,'studioSeconds':12,'sourceUrl':None})[0])
    def test_08_restart_persistence_and_readonly(self):
        s=self.create();self.stop();self.start(readonly=True)
        try:
            self.assertEqual(s['id'],self.request('/shows/'+s['id'])[1]['id']);self.assertEqual(403,self.request('/shows','POST',self.plan())[0]);self.assertTrue(self.request('/config')[1]['readOnly'])
        finally: self.stop();self.start()
    def test_09_simultaneous_writers(self):
        s=self.create();payload={'expectedVersion':s['version'],'plan':s['draft']['plan']}
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(lambda _:self.request('/shows/'+s['id'],'PUT',payload)[0], range(2)))
        self.assertEqual([200,409],sorted(statuses))
        self.assertEqual(2,len(self.request('/shows/'+s['id'])[1]['history']))

if __name__=='__main__': unittest.main(verbosity=2)
