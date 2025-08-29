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

EXPOSE 3000

CMD [ "npm", "run", "dev" ]