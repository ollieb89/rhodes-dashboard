FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build args become env vars for NEXT_PUBLIC_* at build time
ARG NEXT_PUBLIC_API_URL=http://backend:8521
ARG NEXT_PUBLIC_DASHBOARD_API_KEY=""

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DASHBOARD_API_KEY=$NEXT_PUBLIC_DASHBOARD_API_KEY

RUN npm run build

# Production image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3489

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3489

CMD ["node", "server.js"]
