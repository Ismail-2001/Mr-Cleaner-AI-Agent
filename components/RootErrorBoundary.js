'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function RootErrorBoundary({ children }) {
    return (
        <ErrorBoundary>
            {children}
        </ErrorBoundary>
    );
}
