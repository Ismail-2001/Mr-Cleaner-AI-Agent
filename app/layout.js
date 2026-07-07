import './globals.css';
import RootErrorBoundary from '@/components/RootErrorBoundary';

export const metadata = {
  title: 'Mr. Cleaner Mobile Detailing | Premium Car Care in Texas',
  description: 'Pro mobile detailing services in Texas. Book your car wash, interior detail, or ceramic coating in 60 seconds with Maya, our AI assistant.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RootErrorBoundary>
          {children}
        </RootErrorBoundary>
      </body>
    </html>
  );
}
