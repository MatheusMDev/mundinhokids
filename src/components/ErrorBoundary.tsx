import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { TelaErro } from '../pages/Erro';

interface Props {
  children: ReactNode;
}

interface PropsCaptura extends Props {
  /** Endereço atual: ao mudar (ex.: "Voltar para o início"), a tela de erro sai */
  endereco: string;
}

interface State {
  aconteceu: boolean;
}

class CapturaErro extends Component<PropsCaptura, State> {
  state: State = { aconteceu: false };

  static getDerivedStateFromError(): State {
    return { aconteceu: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro inesperado na aplicação:', error, info.componentStack);
  }

  componentDidUpdate(anterior: PropsCaptura) {
    if (this.state.aconteceu && anterior.endereco !== this.props.endereco) this.setState({ aconteceu: false });
  }

  render() {
    if (this.state.aconteceu) return <TelaErro />;
    return this.props.children;
  }
}

export function ErrorBoundary({ children }: Props) {
  const { pathname } = useLocation();
  return <CapturaErro endereco={pathname}>{children}</CapturaErro>;
}
