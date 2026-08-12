import { Routes, Route } from 'react-router';
import { StoreProvider } from '@/lib/store';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<StoreProvider><Home /></StoreProvider>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
