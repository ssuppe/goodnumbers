# Auth.js v5 Auth Express documentation (https://authjs.dev/getting-started/installation)

Getting Started
Installation
Installing Auth.js
Start by installing the appropriate package for your framework.

npm install @auth/express

Installing @auth/core is not necessary, as a user you should never have to interact with @auth/core.

Setup Environment
The only environment variable that is mandatory is the AUTH_SECRET. This is a random value used by the library to encrypt tokens and email verification hashes. (See Deployment to learn more). You can generate one via the official Auth.js CLI running:

npx auth secret

This will also add it to your .env file, respecting the framework conventions (eg.: Next.js’ .env.local).

Configure
Next, create the Auth.js config file and object. This is where you can control the behaviour of the library and specify custom authentication logic, adapters, etc. We recommend all frameworks to create an auth.ts file in the project. In this file we’ll pass in all the options to the framework specific initialization function and then export the route handler(s), signin and signout methods, and more.

You can name this file whatever you want and place it wherever you like, these are just conventions we’ve come up with.

Start by importing ExpressAuth and adding the handler to the auth route.
./src/routes/auth.route.ts

import { ExpressAuth } from "@auth/express"
import express from "express"

const app = express()

// If your app is served through a proxy
// trust the proxy to allow us to read the `X-Forwarded-*` headers
app.set("trust proxy", true)
app.use("/auth/\*", ExpressAuth({ providers: [] }))
Note this creates the Auth.js API, but does not yet protect resources. Continue on to protecting resources for more details.

Setup Authentication Methods
With that, the basic setup is complete! Next we’ll setup the first authentication methods and fill out that providers array.

######### OAUTH WITH GOOGLE ###########

Getting Started
Authentication
OAuth
OAuth
Auth.js comes with over 80 providers preconfigured. We constantly test ~20 of the most popular ones, by having them enabled and actively used in our example application. You can choose a provider below to get a walk-through, or find your provider of choice in the sidebar for further details.

Google
1Register OAuth App in Google's dashboard
First you have to setup an OAuth application on the Google developers dashboard.

If you haven’t used OAuth before, you can read the beginners step-by-step guide on how to setup "Sign in with GitHub" with Auth.js.
When registering an OAuth application on Google, they will all ask you to enter your application’s callback URL. See below for the callback URL you must insert based on your framework.

Callback URL
[origin]/auth/callback/google

Many providers only allow you to register one callback URL at a time. Therefore, if you want to have an active OAuth configuration for development and production environments, you'll need to register a second OAuth app in the Google dashboard for the other environment(s).
2Setup Environment Variables
Once registered, you should receive a Client ID and Client Secret. Add those in your application environment file:

.env

AUTH_GOOGLE_ID={CLIENT_ID}
AUTH_GOOGLE_SECRET={CLIENT_SECRET}
Assuming dotenv is installed or you're using Node 20 .env file feature.

Auth.js will automatically pick up these if formatted like the example above. You can also use a different name for the environment variables if needed, but then you’ll need to pass them to the provider manually.

3Setup Provider
Let’s enable Google as a sign in option in our Auth.js configuration. You’ll have to import the Google provider from the package and pass it to the providers array we setup earlier in the Auth.js config file:

./src/routes/auth.route.ts

import { ExpressAuth } from "@auth/express"
import Google from "@auth/express/providers/google"
import express from "express"

const app = express()

// If app is served through a proxy, trust the proxy to allow HTTPS protocol to be detected
app.set('trust proxy', true)
app.use("/auth/\*", ExpressAuth({ providers: [ Google ] }))
4Add Signin Button
Next, we can add a signin button somewhere in your application like the Navbar. It will trigger Auth.js sign in when clicked.

Express not documented yet. Help us by contributing here.

5Ship it!
Click the “Sign in with Google" button and if all went well, you should be redirected to Google and once authenticated, redirected back to the app!

You can build your own Signin, Signout, etc. pages to match the style of your application, check out session management for more details.
For more information on this provider check out the detailed Google provider docs page.

Last updated on June 22, 2025

########## PRISMA ################
Prisma Adapter
Resources
Prisma documentation
Setup
Installation
npm install @prisma/client @auth/prisma-adapter
npm install prisma --save-dev

Environment Variables
Prisma needs to set up the environment variable to establish a connection with your database and retrieve data. Prisma requires the DATABASE_URL environment variable to create the connection. For more information, read the docs.

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA

Configuration
To improve performance using Prisma ORM, we can set up the Prisma instance to ensure only one instance is created throughout the project and then import it from any file as needed. This approach avoids recreating instances of PrismaClient every time it is used. Finally, we can import the Prisma instance from the auth.ts file configuration.

prisma.ts

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
We recommend using version @prisma/client@5.12.0 or above if using middleware or any other edge runtime(s). See edge compatibility below for more information.

./src/routes/auth.route.ts

import { ExpressAuth } from "@auth/express"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma"

const app = express()

app.set("trust proxy", true)
app.use(
"/auth/\*",
ExpressAuth({
providers: [],
adapter: PrismaAdapter(prisma),
})
)
Edge Compatibility
Prisma has shipped edge runtime support for their client in version 5.12.0. You can read more about it on their edge documentation. This requires specific database drivers and therefore is only compatible with certain database types / hosting providers. Check their list of supported drivers before getting started. You can check out an example Auth.js application with next-auth and Prisma on the edge here.

For more about edge compatibility in general, check out our edge compatibility guide.

The original database edge-runtime workaround, to split your auth.ts configuration into two, will be kept below.

Old Edge Workaround
At the moment, Prisma is still working on being fully compatible with edge runtimes like Vercel’s. See the issue being tracked here, and Prisma’s announcement about early edge support in the 5.9.1 changelog. There are two options to deal with this issue:

Use the Prisma’s Accelerate feature
Follow our Edge Compatibility page as the workaround. This uses the jwt session strategy and separates the auth.ts configuration into two files.
Using Prisma with the jwt session strategy and @prisma/client@5.9.1 or above doesn’t require any additional modifications, other than ensuring you don’t do any database queries in your middleware.

Since @prisma/client@5.9.1, Prisma no longer throws about being incompatible with the edge runtime at instantiation, but at query time. Therefore, it is possible to import it in files being used in your middleware as long as you do not execute any queries in your middleware.

Schema
You need to use at least Prisma 2.26.0. Create a schema file at prisma/schema.prisma with the following models.

PostgreSQL

MySQL

SQLite

MongoDB
Apply Schema
This will create an SQL migration file and execute it:

npm exec prisma migrate dev

Note that you will need to specify your database connection string in the environment variable DATABASE_URL. You can do this by setting it in a .env file at the root of your project.

Generate Prisma Client
prisma migrate dev will also generate the Prisma client, but if you need to generate it again manually you can run the following command.

npm exec prisma generate

Development Workflow
When you’re working on your application and making changes to your database schema, you’ll need to run the migrate command again every time you make changes to the schema in order for Prisma to (1) generate a migration file and apply it to the underlying database and (2) regenerate the Prisma client in your project with the latest types and model methods.

npm exec prisma migrate dev

Naming Conventions
If mixed snake_case and camelCase column names is an issue for you and/or your underlying database system, we recommend using Prisma’s @map() feature to change the field names. This won’t affect Auth.js, but will allow you to customize the column names to whichever naming convention you prefer.

For example, moving to snake_case and plural table names.

schema.prisma

model Account {
id String @id @default(cuid())
userId String @map("user_id")
type String
provider String
providerAccountId String @map("provider_account_id")
refresh_token String? @db.Text
access_token String? @db.Text
expires_at Int?
token_type String?
scope String?
id_token String? @db.Text
session_state String?

user User @relation(fields: [userId], references: [id], onDelete: Cascade)

@@unique([provider, providerAccountId])
@@map("accounts")
}

model Session {
id String @id @default(cuid())
sessionToken String @unique @map("session_token")
userId String @map("user_id")
expires DateTime
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

@@map("sessions")
}

model User {
id String @id @default(cuid())
name String?
email String? @unique
emailVerified DateTime? @map("email_verified")
image String?
accounts Account[]
sessions Session[]

@@map("users")
}

model VerificationToken {
identifier String
token String
expires DateTime

@@unique([identifier, token])
@@map("verification_tokens")
}
Last updated on June 22, 2025

########### SIGN IN AND SIGN OUT ###########3
Getting Started
Session Management
Signin and Signout
Handling Signin and Signout
To signin your users, make sure you have at least one authentication method setup. You then need to build a button which will call the sign in function from your Auth.js framework package.

The Express package runs server-side and therefore it doesn’t make sense to create a “SignIn button component”. However, to signin or signout with Express, send a request to the appropriate REST API Endpoints from your client (i.e. /auth/signin, /auth/signout, etc.).

To sign in users with Express, you can create a route that handles the sign-in logic. Here is an example:

src/routes/auth.ts

import express, { Request, Response } from "express"
import { signIn } from "../auth"
const router = express.Router()

router.post("/auth/signin", async (req: Request, res: Response) => {
try {
await signIn(req, res)
res.redirect("/dashboard")
} catch (error) {
res.status(500).send("Sign in failed")
}
})

export { router }
To sign out users with Express, you can create a route that handles the sign-out logic. Here is an example:

src/routes/auth.ts

import express, { Request, Response } from "express"
import { signOut } from "../auth"
const router = express.Router()

router.post("/auth/signout", async (req: Request, res: Response) => {
try {
await signOut(req, res)
res.redirect("/")
} catch (error) {
res.status(500).send("Sign out failed")
}
})

export { router }
You can also pass a provider to the signIn function which will attempt to login directly with that provider. Otherwise, when clicking this button in your application, the user will be redirected to the configured sign in page. If you did not setup a custom sign in page, the user will be redirected to the default signin page at /[basePath]/signin.

Once authenticated, the user will be redirected back to the page they started the signin from. If you want the user to be redirected somewhere else after sign in (.i.e /dashboard), you can do so by passing the target URL as redirectTo in the sign-in options.

src/routes/auth.ts

import express, { Request, Response } from "express";
import { signOut } from "../auth";
const router = express.Router()

router.post("/auth/signout", async (req: Request, res: Response) => {
try {
await signOut(req, res)
res.redirect("/")
} catch (error) {
res.status(500).send("Sign out failed")
}
})

export { router }
Signout
Signing out can be done similarly to signing in. Most frameworks offer both a client-side and server-side method for signing out as well.

The Express package runs server-side and therefore it doesn’t make sense to create a “SignIn button component”. However, to signin or signout with Express, send a request to the appropriate REST API Endpoints from your client (i.e. /auth/signin, /auth/signout, etc.).

To sign in users with Express, you can create a route that handles the sign-in logic. Here is an example:

src/routes/auth.ts

import express, { Request, Response } from "express"
import { signIn } from "../auth"
const router = express.Router()

router.post("/auth/signin", async (req: Request, res: Response) => {
try {
await signIn(req, res)
res.redirect("/dashboard")
} catch (error) {
res.status(500).send("Sign in failed")
}
})

export { router }
To sign out users with Express, you can create a route that handles the sign-out logic. Here is an example:

src/routes/auth.ts

import express, { Request, Response } from "express"
import { signOut } from "../auth"
const router = express.Router()

router.post("/auth/signout", async (req: Request, res: Response) => {
try {
await signOut(req, res)
res.redirect("/")
} catch (error) {
res.status(500).send("Sign out failed")
}
})

export { router }
Note that when signing out of an OAuth provider like GitHub in an Auth.js application, the user will not be signed out of GitHub elsewhere.

######### Getting SESSION ###########
Session Management
Get Session
Get Session
Once a user is logged in, you often want to get the session object in order to use the data in some way. A common use-case is to show their profile picture or display some other user information.

app.ts

import { getSession } from "@auth/express"

export function authSession(req: Request, res: Response, next: NextFunction) {
res.locals.session = await getSession(req)
next()
}

app.use(authSession)

// Now in your route
app.get("/", (req, res) => {
const { session } = res.locals
res.render("index", { user: session?.user })
})
If you’d like to extend your session with more fields from your OAuth provider, for example, please check out our “extending the session” guide.

By default, GET requests to the session endpoint will automatically return the headers to prevent caching.

########### DEPLOYMENT ################
Deployment
Environment Variables
For consistency, we recommend prefixing all Auth.js environment variables with AUTH\_. This way we can better autodetect them, and they can also be distinguished from other environment variables more easily.

Auth.js libraries require you to set an AUTH_SECRET environment variable. This is used to encrypt cookies and tokens. It should be a cryptographically secure random string of at least 32 characters:

npm exec auth secret

If you are using an OAuth Provider, your provider will provide you with a Client ID and Client Secret that you will need to set as environment variables as well (in the case of an OIDC provider, like Auth0, a third issuer value might be also required, refer to the provider’s specific documentation).

Auth.js supports environment variable inference, meaning that if you name your provider environment variables following a specific syntax, you won’t need to explicitly pass them to the providers in your configuration.

Client ID’s and client secrets should be named AUTH*[PROVIDER]\_ID and AUTH*[PROVIDER]_SECRET. If your provider requires an issuer, that should be named AUTH_[PROVIDER]\_ISSUER. For example:

AUTH_OKTA_ID=abc
AUTH_OKTA_SECRET=abc
AUTH_OKTA_ISSUER=abc

For more information, check out our environment variables page.

AUTH_SECRET
This is the only strictly required environment variable. It is the secret used to encode the JWT and encrypt things in transit. As mentioned above, we recommend at least a 32 character random string. This can be generated via the CLI with npm exec auth secret or via openssl with openssl rand -base64 33.

AUTH_TRUST_HOST
When deploying your application behind a reverse proxy, you’ll need to set AUTH_TRUST_HOST equal to true. This tells Auth.js to trust the X-Forwarded-Host header from the reverse proxy. Auth.js will automatically infer this to be true if we detect the environment variable indicating that your application is running on one of the supported hosting providers. Currently VERCEL and CF_PAGES (Cloudflare Pages) are supported.

AUTH_URL
This environment variable is mostly unnecessary with v5 as the host is inferred from the request headers. However, if you are using a different base path, you can set this environment variable as well. For example, AUTH_URL=http://localhost:3000/web/auth or AUTH_URL=https://company.com/app1/auth

AUTH_REDIRECT_PROXY_URL
NOTE: Some providers (eg Apple) do not support redirect proxy usage.

This environment variable is designed for advanced use-cases only, when using Auth.js as a proxy for preview deploys, for example. For more details, see the securing preview deploys section below.

Serverless
Create the required environment variables for your desired environments. Don’t forget to also add the required environment variables for your provider(s) of choice (i.e. OAuth clientId / clientSecret, etc.).
When using an OAuth provider, make sure the callback URL for your production URL is setup correctly. Many OAuth providers will only allow you to set 1 callbackUrl per OAuth application. In which case, you’ll need to create separate applications for each environment (development, production, etc.). Other providers, like Google, allow you to add many callbackUrls to one application.
By default, the callbackUrl for next-auth (Next.js) applications should look something like this: https://company.com/api/auth/callback/[provider] (replace company.com with your domain and provider with the provider name, i.e. github).
All other frameworks (@auth/sveltekit, @auth/express, etc.), by default, will use the path /auth/callback/[provider].
Deploy! After having setup those two prerequisites, you should be able to deploy and run your Auth.js application on Netlify, Vercel, etc.
If you are storing users in a database, we recommend using a different OAuth app for development/production so that you don’t mix your test and production user base.

Observability
To pass on your current user’s details on to your observability tools, you can use the callbacks provided by Auth.js. For example, in the session callback, you could pass the user.id on to Sentry.

auth.ts

import \* as Sentry from "@sentry/browser"
import NextAuth from "next-auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
callbacks: {
session({ session, user }) {
const scope = Sentry.getCurrentScope()

      scope.setUser({
        id: user.id,
        email: user.email,
      })

      return session
    },

},
})
Self-hosted
Auth.js can also be deployed anywhere you can deploy your framework of choice. Check out the framework’s documentation on self-hosting.

Docker
In a Docker environment, make sure to set either trustHost: true in your Auth.js configuration or the AUTH_TRUST_HOST environment variable to true.

Our example application is also hosted via Docker here (see the source code). Below is an example Dockerfile for a Next.js application using Auth.js.

Dockerfile

# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

# Install dependencies only when needed

FROM base AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies

COPY package.json pnpm-lock.yaml\* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.

# Learn more here: https://nextjs.org/telemetry

# Uncomment the following line in case you want to disable telemetry during the build.

# ENV NEXT_TELEMETRY_DISABLED 1

RUN corepack enable pnpm && pnpm build

# Production image, copy all the files and run next

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Uncomment the following line in case you want to disable telemetry during runtime.

# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache

RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size

# https://nextjs.org/docs/advanced-features/output-file-tracing

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# server.js is created by next build from the standalone output

# https://nextjs.org/docs/pages/api-reference/next-config-js/output

CMD ["node", "server.js"]
Securing a preview deployment
NOTE: Some providers (eg Apple) do not support redirect proxy usage.

Most OAuth providers cannot be configured with multiple callback URLs or using a wildcard.

However, Auth.js supports Preview deployments, even with most OAuth providers. The idea is to have one deployment which proxies authentication requests to the dynamic URLs of your main application. So you could have 1 stable deployment, like at auth.company.com where you would point all your OAuth provider’s callbackUrls, and this application would then, upon successful authentication, redirect the user back to the preview deploy URL, like https://git-abc123-myapp.vercel.app. Follow these steps to get started with securing preview deploys with Auth.js.

Determine a stable deployment URL. For example, a deployment whose URL does not change between builds, for example. auth.yourdomain.com (using a subdomain is not a requirement, this can be the main site’s URL too, for example.)
In both the preview and stable environment, set AUTH_REDIRECT_PROXY_URL to that stable deployment URL, including the path from where Auth.js handles the routes. Eg.: (https://auth.yourdomain.com/api/auth). If the variable is not set in the stable environment, the proxy functionality will not be enabled!
Update the callbackUrl in your OAuth provider’s configuration to use the stable deployment URL. For example, for GitHub it would be https://auth.yourdomain.com/api/auth/callback/github.
Fun fact: all of our example apps are using the proxy functionality!

To support preview deployments, the AUTH_SECRET value needs to be the same for the stable deployment and deployments that will need OAuth support.

########## TYPESCRIPT ##########

TypeScript
Auth.js is committed to type-safety, so it’s written in TypeScript and 100% type safe. It comes with its own type definitions to use in your project.

Even if you don’t use TypeScript, IDEs like VS Code will pick this up to provide you with a better developer experience. While you are typing, you will get suggestions about what certain objects/functions look like, and sometimes links to documentation, examples, and other valuable resources.

Philosophy
We have chosen module augmentation over generics as the main technique to type Auth.js resources across your application in case you extend them.

Module Augmentation
Auth.js libraries come with certain interfaces that are shared across submodules and different Auth.js libraries (For example: next-auth and @auth/prisma-adapter will rely on types from @auth/core).

Good examples of such interfaces are Session or User. You can use TypeScript’s Module Augmentation to extend these types to add your own properties across Auth.js without having to pass generic all over the place.

Let’s look at extending Session for example.

auth.ts

import { ExpressAuthConfig } from "@auth/express";
// Extend the default Session type to include custom properties
declare module "@auth/express" {
interface Session {
user: {
id: string; // Add a custom `id` property to the session user object
};
}
}

export const authConfig: ExpressAuthConfig = {
callbacks: {
/\*\*
_ The `session` callback is used to customize the session object
_ returned to the client. Here, we add a custom `id` property to
_ the session user object, which is populated from the JWT token.
_
_ @param session - The current session object.
_ @param token - The JWT token containing user information.
_ @returns The modified session object with the custom `id` property.
_/
async session({ session, token }) {
if (token.sub) {
// Add the `id` property to the session user object
session.user.id = token.sub; // `token.sub` contains the user ID
}
return session;
},
},
};
Module augmentation is not limited to specific interfaces. You can augment any interface we’ve defined, here are some of the more common interfaces that you might want to override based on your use case.

types.d.ts

declare module "next-auth" {
/\*\*

- The shape of the user object returned in the OAuth providers' `profile` callback,
- or the second parameter of the `session` callback, when using a database.
  \*/
  interface User {}
  /\*\*
- The shape of the account object returned in the OAuth providers' `account` callback,
- Usually contains information about the provider being used, like OAuth tokens (`access_token`, etc).
  \*/
  interface Account {}

/\*\*

- Returned by `useSession`, `auth`, contains information about the active session.
  \*/
  interface Session {}
  }

// The `JWT` interface can be found in the `next-auth/jwt` submodule
import { JWT } from "next-auth/jwt"

declare module "next-auth/jwt" {
/** Returned by the `jwt` callback and `auth`, when using JWT sessions \*/
interface JWT {
/** OpenID ID Token \*/
idToken?: string
}
}
The module declaration can be added to any file that is “included” in your project’s tsconfig.json.
