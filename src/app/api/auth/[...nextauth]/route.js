import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';

const ALLOWED_DOMAIN = '@chandakgroup.com';

const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: {
          prompt: 'select_account', // Always show the Microsoft account picker
        },
      },
    }),
  ],

  callbacks: {
    // Block sign-in for any non-chandakgroup.com account
    async signIn({ profile }) {
      const email = profile?.email ?? profile?.preferred_username ?? '';
      return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
    },

    // Expose name + email in the session
    async session({ session, token }) {
      if (token?.email) session.user.email = token.email;
      if (token?.name)  session.user.name  = token.name;
      return session;
    },

    async jwt({ token, profile }) {
      if (profile) {
        token.email = profile.email ?? profile.preferred_username;
        token.name  = profile.name ?? profile.displayName;
      }
      return token;
    },
  },

  pages: {
    signIn: '/',           // Use our home page — never show NextAuth's built-in page
    error:  '/auth/error', // Custom error page
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
