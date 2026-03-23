import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button, Result } from "antd";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false });
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle="This page crashed unexpectedly. You can try again or go back to the dashboard."
          extra={[
            <Button key="retry" type="primary" onClick={this.handleReset}>
              Try Again
            </Button>,
            <Button key="home" onClick={this.handleGoHome}>
              Go to Dashboard
            </Button>,
          ]}
        />
      );
    }

    return this.props.children;
  }
}
