// Página que só alguns perfis enxergam: quem não tem acesso vê um aviso,
// mesmo digitando o endereço direto (o menu já esconde o que não é do perfil).

import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { useEstado, type Tela } from '../lib/estado';

export function Restrita({ tela, children }: { tela: Tela; children: ReactNode }) {
  const { telas, inicio } = useEstado();
  if (telas.has(tela)) return <>{children}</>;
  // O início de quem não usa o calendário é a própria tela dele
  if (tela === 'painel') return <Navigate to={inicio} replace />;
  return (
    <Layout>
      <section className="cartao" style={{ maxWidth: 520 }}>
        <h1 style={{ marginBottom: 8 }}>Página fora do seu acesso</h1>
        <p className="suave" style={{ margin: '0 0 16px' }}>
          Esta parte do sistema não faz parte do seu perfil. Se precisar dela, fale com a gerente ou a direção.
        </p>
        <Link to={inicio} className="botao primario">Voltar para o início</Link>
      </section>
    </Layout>
  );
}
