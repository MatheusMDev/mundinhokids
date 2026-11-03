import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TelaErro } from '../pages/Erro';

interface Props {
  children: ReactNode;
}

interface State {
  aconteceu: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { aconteceu: false };

  static getDerivedStateFromError(): State {
    return { aconteceu: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro inesperado na aplicação:', error, info.componentStack);
  }

  render() {
    if (this.state.aconteceu) return <TelaErro />;
    return this.props.children;
  }
}
