import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import VisitorRegistration from './pages/VisitorRegistration'
import VisitorApproval from './pages/VisitorApproval'
import QRCheckInOut from './pages/QRCheckInOut'
import VehicleEntryPage from './pages/VehicleEntry'
import Reports from './pages/Reports'
import Master from './pages/Master'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/master" element={<Master />} />
        <Route path="/registration" element={<VisitorRegistration />} />
        <Route path="/approvals" element={<VisitorApproval />} />
        <Route path="/checkpoint" element={<QRCheckInOut />} />
        <Route path="/vehicles" element={<VehicleEntryPage />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
