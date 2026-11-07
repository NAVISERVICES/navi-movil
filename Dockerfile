# Servidor de Navi: sitios (Navi Móvil y Navi Empresas) + API de NAVI Mando.
# Una sola imagen con Node; los datos viven en el volumen /data.
FROM node:26-alpine
WORKDIR /srv/site
COPY . .
ENV NODE_ENV=production PORT=8080 STATIC_ROOT=/srv/site DATA_DIR=/data TRUST_PROXY=1
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "server/src/server.js"]
