"use client";

import { Component, type ReactNode } from "react";

interface Props {
  type: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors thrown by an individual block. One bad block can't
 * crash the whole post — the failing block is replaced with a small dashed
 * placeholder and the rest of the article continues rendering normally.
 */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[BlockErrorBoundary]", this.props.type, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="my-4 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Failed to render block <code className="font-mono">{this.props.type}</code>.
        </div>
      );
    }
    return this.props.children;
  }
}
