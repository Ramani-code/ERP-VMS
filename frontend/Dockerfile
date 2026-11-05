# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# --- serve ---
FROM nginx:1.27-alpine
ENV BACKEND_URL=http://backend:8080
# the official image runs envsubst on /etc/nginx/templates/*.template at start-up
# (only ${BACKEND_URL} is substituted; nginx's own $variables are left alone)
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/healthz || exit 1
