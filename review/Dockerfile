FROM node:24-alpine AS build

WORKDIR /app
COPY review/package*.json ./
RUN npm ci
COPY review/ ./
RUN npm run build

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY review/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
