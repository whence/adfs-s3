FROM node:6.4.0-slim

# cache dependencies
COPY ["package.json", "npm-shrinkwrap.json", "/app/"]
WORKDIR /app
RUN ["npm", "install", "--loglevel", "warn"]

# copy code
COPY [".", "/app/"]
EXPOSE 3000
CMD ["npm", "start"]
