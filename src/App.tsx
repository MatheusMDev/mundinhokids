import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProvedorEstado } from './lib/estado';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Painel } from './pages/Painel';
import { DetalheEvento } from './pages/DetalheEvento';
import { PdfEvento } from './pages/PdfEvento';
import { Configuracoes } from './pages/Configuracoes';
import { Usuarios } from './pages/Usuarios';
import {
  CadastrosGerais, Eventos, Fantasias, Financeiro, Mais, Personagens, Profissionais, Veiculos,
} from './pages/Cadastros';
import { TelaErro } from './pages/Erro';
import { Restrita } from './components/Restrita';
import { Notificacoes } from './pages/Notificacoes';

export function App() {
  return (
    <ProvedorEstado>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Restrita tela="painel"><Painel /></Restrita>} />
            <Route path="/eventos" element={<Restrita tela="eventos"><Eventos /></Restrita>} />
            <Route path="/eventos/:id" element={<Restrita tela="eventos"><DetalheEvento /></Restrita>} />
            <Route path="/eventos/:id/pdf" element={<Restrita tela="eventos"><PdfEvento /></Restrita>} />
            <Route path="/notificacoes" element={<Restrita tela="notificacoes"><Notificacoes /></Restrita>} />
            <Route path="/profissionais" element={<Restrita tela="profissionais"><Profissionais /></Restrita>} />
            <Route path="/personagens" element={<Restrita tela="personagens"><Personagens /></Restrita>} />
            <Route path="/fantasias" element={<Restrita tela="fantasias"><Fantasias /></Restrita>} />
            <Route path="/veiculos" element={<Restrita tela="veiculos"><Veiculos /></Restrita>} />
            <Route path="/financeiro" element={<Restrita tela="financeiro"><Financeiro /></Restrita>} />
            <Route path="/cadastros" element={<Restrita tela="cadastros"><CadastrosGerais /></Restrita>} />
            <Route path="/mais" element={<Mais />} />
            <Route path="/usuarios" element={<Restrita tela="usuarios"><Usuarios /></Restrita>} />
            <Route path="/configuracoes" element={<Restrita tela="configuracoes"><Configuracoes /></Restrita>} />
            <Route path="*" element={<TelaErro paginaNaoEncontrada />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ProvedorEstado>
  );
}
