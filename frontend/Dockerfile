FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . ./

ARG REACT_APP_API_URL=/api/v1/
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

CMD ["cp", "-r", "/app/build/.", "/frontend_static/"]
