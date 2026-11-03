import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProvedorEstado } from './lib/estado';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Painel } from './pages/Painel';
import { DetalheEvento } from './pages/DetalheEvento';
import { PdfEvento } from './pages/PdfEvento';
import {
  CadastrosGerais, Eventos, Fantasias, Financeiro, Mais, Personagens, Profissionais, Veiculos,
} from './pages/Cadastros';
import { TelaErro } from './pages/Erro';

export function App() {
  return (
    <ProvedorEstado>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Painel />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/eventos/:id" element={<DetalheEvento />} />
            <Route path="/eventos/:id/pdf" element={<PdfEvento />} />
            <Route path="/profissionais" element={<Profissionais />} />
            <Route path="/personagens" element={<Personagens />} />
            <Route path="/fantasias" element={<Fantasias />} />
            <Route path="/veiculos" element={<Veiculos />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/cadastros" element={<CadastrosGerais />} />
            <Route path="/mais" element={<Mais />} />
            <Route path="*" element={<TelaErro paginaNaoEncontrada />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ProvedorEstado>
  );
}
