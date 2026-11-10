import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary ${this.props.name || 'Component'}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center text-xs text-white/50 select-none">
          <span className="text-amber-400/80 font-medium mb-1">
            {this.props.fallbackTitle || 'Panel could not load'}
          </span>
          <button
            type="button"
            className="text-[11px] text-white/70 hover:text-white underline mt-1 cursor-pointer bg-transparent border-none"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

