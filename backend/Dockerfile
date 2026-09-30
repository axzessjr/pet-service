FROM node:24-alpine AS build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
COPY proto/ /app/proto/
RUN npm run build

FROM node:24-alpine

WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/proto /app/proto
EXPOSE 3000
CMD ["node", "dist/main.js"]
