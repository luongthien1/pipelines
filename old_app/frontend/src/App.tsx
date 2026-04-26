import { Navigate, Route, Routes, useParams, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DatasetList from './components/DatasetList';
import DatasetDetail from './components/DatasetDetail';
import ModelList from './components/ModelList';
import ModelDetail from './components/ModelDetail';
import PipelineList from './components/PipelineList';

function App() {
  return (
    <div className="app-shell">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-surface p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/datasets" replace />} />
            <Route path="/datasets" element={<DatasetList />} />
            <Route path="/datasets/:datasetId" element={<DatasetDetailWrapper />} />
            <Route path="/models" element={<ModelList />} />
            <Route path="/models/:modelId" element={<ModelDetailWrapper />} />
            <Route path="/pipelines" element={<PipelineList />} />
            <Route path="/pipelines/:pipelineId" element={<PipelineList />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// Wrappers to extract params and pass to components
const DatasetDetailWrapper = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  return <DatasetDetail datasetId={Number(datasetId)} onBack={() => navigate('/datasets')} />;
};

const ModelDetailWrapper = () => {
  const { modelId } = useParams();
  const navigate = useNavigate();
  return <ModelDetail modelId={Number(modelId)} onBack={() => navigate('/models')} />;
};

export default App;
