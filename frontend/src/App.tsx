import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/shared/Layout';
import Dashboard from './pages/Dashboard';
import AppsLibrary from './pages/AppsLibrary';
import AppBuilder from './pages/AppBuilder';
import AppPlayer from './pages/AppPlayer';
import Tables from './pages/Tables';
import TableDetail from './pages/TableDetail';
import Analytics from './pages/Analytics';
import Stations from './pages/Stations';
import Schedule from './pages/Schedule';
import PlantView from './pages/PlantView';
import ManagerView from './pages/ManagerView';
import CompletionDetail from './pages/CompletionDetail';
import AppHistory from './pages/AppHistory';
import StepMetrics from './pages/StepMetrics';
import CapacityPlanning from './pages/CapacityPlanning';
import OperatorPortal from './pages/OperatorPortal';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/play/:id" element={<AppPlayer />} />
        <Route path="/operator" element={<OperatorPortal />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="apps" element={<AppsLibrary />} />
          <Route path="apps/:id/build" element={<AppBuilder />} />
          <Route path="apps/:id/history" element={<AppHistory />} />
          <Route path="tables" element={<Tables />} />
          <Route path="tables/:id" element={<TableDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="stations" element={<Stations />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="plant" element={<PlantView />} />
          <Route path="manager" element={<ManagerView />} />
          <Route path="step-metrics" element={<StepMetrics />} />
          <Route path="capacity" element={<CapacityPlanning />} />
          <Route path="completions/:id" element={<CompletionDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
