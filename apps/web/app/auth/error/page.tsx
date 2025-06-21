'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Suspense } from 'react';

const errorMessages = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or is invalid.',
  Default: 'An error occurred while signing in.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get('error');
  const error = errorKey && Object.prototype.hasOwnProperty.call(errorMessages, errorKey)
    ? (errorKey as keyof typeof errorMessages)
    : 'Default';
  
  const message = errorMessages[error];

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-destructive">Sign In Error</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          {message}
        </p>
        
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href="/auth/login">
              Try Again
            </Link>
          </Button>
          
          <Button variant="outline" asChild>
            <Link href="/">
              Go Home
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Sign In Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Loading...
            </p>
          </CardContent>
        </Card>
      }>
        <ErrorContent />
      </Suspense>
    </div>
  );
}