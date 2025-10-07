FROM node:20-alpine

LABEL author="OZ3N corp"
LABEL version="0.0.1"
LABEL maintainer="Hamza <hmouhib@student.1337.ma>"
LABEL maintainer="Aziz <aelkheta@student.1337.ma>"
LABEL description="backend API for ft_transcendence"
LABEL repository="https://github.com/iTsLhaj/backend"
LABEL liscense="GNU General Public License v3.0"
LABEL homepage="https://github.com/iTsLhaj/backend#readme"
LABEL vcs-url="https://github.com/iTsLhaj/backend"
LABEL vcs-ref="d63dd03f8ea94b98f2a1490480306c320bc1927a"
LABEL build-date="2025-08-29T22:00:00Z"
LABEL org.opencontainers.image.source="https://github.com/iTsLhaj/backend"
LABEL org.opencontainers.image.title="ft_transcendence.backend"
LABEL org.opencontainers.image.description="backend API for ft_transcendence"
LABEL org.opencontainers.image.version="0.0.1"
LABEL org.opencontainers.image.url="https://github.com/iTsLhaj/backend"
LABEL environment="dev"

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma migrate dev --name init
RUN npx prisma generate

# FILEBEAT INSTALLATION
RUN apk add --no-cache curl tar \
    && FILEBEAT_VERSION=8.10.0 \
    && curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-$FILEBEAT_VERSION-linux-x86_64.tar.gz \
    && tar xzf filebeat-$FILEBEAT_VERSION-linux-x86_64.tar.gz \
    && mv filebeat-$FILEBEAT_VERSION-linux-x86_64 /usr/share/filebeat \
    && rm filebeat-$FILEBEAT_VERSION-linux-x86_64.tar.gz

# Copy your Filebeat config
COPY filebeat.yml /usr/share/filebeat/filebeat.yml

EXPOSE 3000

# Start Node app + Filebeat (background)
CMD [ "sh", "-c", "/usr/share/filebeat/filebeat -c /usr/share/filebeat/filebeat.yml & npm start" ]

# CMD ["sh", "-c", "npx prisma migrate dev && npm start"]
# CMD [ "npx", "prisma", "migrate", "dev", "&&", "npm", "start" ]