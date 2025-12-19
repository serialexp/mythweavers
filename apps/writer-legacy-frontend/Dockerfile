FROM node:lts

COPY . /application

WORKDIR /application

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    && apt-get clean
RUN npm install -g pnpm && pnpm install && pnpm run build

CMD pnpm start

EXPOSE 3000
