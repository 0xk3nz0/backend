all: build run

build:
	docker build -t pong-rush-api .

run:
	docker run -p 3000:3000 --rm --name pong-rush-api -it pong-rush-api

clean:
	docker rm -f pong-rush-api || true

fclean: clean
	docker rmi -f pong-rush-api || true

re: fclean all
