import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { 
  MessageSquare, 
  Clock, 
  Euro, 
  TrendingUp,
  CheckCircle,
  Star,
  Users,
  Calendar
} from 'lucide-react';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Redirect authenticated users to dashboard
  if (session) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Claxis AI
            </div>
            <Badge variant="secondary" className="text-xs">Premium</Badge>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-800 bg-clip-text text-transparent">
              Your Salon's AI Assistant Never Sleeps 💤
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Transform your beauty salon with AI that handles WhatsApp, Instagram, and phone calls 24/7. 
              <strong className="text-purple-600"> Most salons see their first new booking within 24 hours!</strong>
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-6 mb-12 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>No technical skills needed</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Setup in under 15 minutes</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Start free, upgrade when ready</span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link href="/onboarding">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg px-8 py-6">
                Start Free (100 conversations) →
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                Watch 2-min Demo
              </Button>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 font-semibold">4.9/5</span>
            </div>
            <p className="text-sm text-gray-600">
              "My salon's bookings increased by 40% in the first month. The AI never misses a message!"
            </p>
            <p className="text-xs text-gray-500 mt-2">- Maria S., Bella Hair Studio Berlin</p>
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">See Real Results in Your First Week</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our AI doesn't just save time – it grows your business by never missing an opportunity
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="text-center border-l-4 border-l-green-500">
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <CardTitle className="text-2xl text-green-600">+40%</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">More bookings from Instagram comments and WhatsApp messages you would have missed</p>
              </CardContent>
            </Card>

            <Card className="text-center border-l-4 border-l-blue-500">
              <CardHeader>
                <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <CardTitle className="text-2xl text-blue-600">3 hours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Daily time saved on message management and booking coordination</p>
              </CardContent>
            </Card>

            <Card className="text-center border-l-4 border-l-purple-500">
              <CardHeader>
                <Euro className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <CardTitle className="text-2xl text-purple-600">€2,800+</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Monthly revenue increase for Professional tier customers</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works (So Simple!)</h2>
            <p className="text-gray-600">Three steps to transform your salon's customer communication</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Connect WhatsApp</h3>
              <p className="text-gray-600">Scan a QR code with your phone. That's it! Your AI assistant is connected.</p>
            </div>

            <div className="text-center">
              <div className="bg-pink-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-pink-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Tell Us About Your Salon</h3>
              <p className="text-gray-600">Add your services, hours, and team. Our AI learns your salon's personality.</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Watch Bookings Flow In</h3>
              <p className="text-gray-600">Your AI handles customer questions and books appointments 24/7, even while you sleep!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Start Free, Scale When You're Ready</h2>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="relative">
              <CardHeader>
                <Badge variant="secondary" className="w-fit mx-auto mb-2">Free Forever</Badge>
                <CardTitle className="text-2xl">€0/month</CardTitle>
                <p className="text-sm text-gray-600">Perfect to get started</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>100 conversations/month</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>WhatsApp automation</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Basic AI responses</span>
                </div>
              </CardContent>
            </Card>

            <Card className="relative border-2 border-purple-500">
              <CardHeader>
                <Badge className="w-fit mx-auto mb-2 bg-purple-500">Most Popular</Badge>
                <CardTitle className="text-2xl">€99.99/month</CardTitle>
                <p className="text-sm text-gray-600">Professional salons</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Unlimited conversations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Instagram automation</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Marketing campaigns</span>
                </div>
                <div className="text-sm font-medium text-green-600">
                  ROI: €2,800-8,700/month
                </div>
              </CardContent>
            </Card>

            <Card className="relative">
              <CardHeader>
                <Badge variant="outline" className="w-fit mx-auto mb-2">Enterprise</Badge>
                <CardTitle className="text-2xl">€299.99/month</CardTitle>
                <p className="text-sm text-gray-600">Large salons</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Everything in Professional</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>24/7 Voice AI receptionist</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Business verification</span>
                </div>
                <div className="text-sm font-medium text-green-600">
                  ROI: €4,600-12,700/month
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Link href="/onboarding">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                Start Your Free Trial →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="text-xl font-bold">Claxis AI</div>
            <Badge variant="secondary">EU GDPR Compliant</Badge>
          </div>
          <p className="text-gray-400 text-sm">
            Premium AI automation for European beauty salons • Data hosted in Frankfurt • Support in 4 EU languages
          </p>
        </div>
      </footer>
    </main>
  );
}