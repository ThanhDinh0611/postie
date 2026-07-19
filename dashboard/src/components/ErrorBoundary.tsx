import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="card text-center" style={{ margin: '1rem 0' }}>
          <span style={{ fontSize: 32 }}>⚠️</span>
          <h3 className="text-danger" style={{ margin: '0.75rem 0' }}>Có lỗi xảy ra</h3>
          <p className="text-muted text-base" style={{ marginBottom: '1rem' }}>
            {this.state.error?.message || 'Đã xảy ra lỗi không mong muốn.'}
          </p>
          <button className="btn btn-primary" onClick={this.handleReset}>
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
