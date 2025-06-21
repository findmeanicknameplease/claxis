import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            A sign in link has been sent to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Click the link in your email to complete the sign in process.
            </p>
            <p className="text-xs text-muted-foreground">
              If you don't see the email, check your spam folder.
            </p>
          </div>
          
          <Button variant="outline" className="w-full" asChild>
            <Link href="/auth/login">
              Use different email
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}