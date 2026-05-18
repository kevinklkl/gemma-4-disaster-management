/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Network } from './pages/Network';
import { DonorView } from './pages/DonorView';
import { IntakeChannelSelector } from './pages/IntakeChannelSelector';
import { MobileIntake } from './pages/MobileIntake';
import { Coverage } from './pages/Coverage';
import { History } from './pages/History';
import { Sagot } from './pages/Sagot';
import { Tickets } from './pages/Tickets';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pulso" element={<Dashboard />} />
          <Route path="/inbox" element={<Navigate to="/network" replace />} />
          <Route path="/network" element={<Network />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/sagot" element={<Sagot />} />
          <Route path="/history" element={<History />} />
          <Route path="/donor-view" element={<DonorView />} />
          <Route path="/intake" element={<IntakeChannelSelector />} />
          <Route path="/intake/type" element={<MobileIntake />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
