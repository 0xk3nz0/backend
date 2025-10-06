all: build run

build:
	@echo "🚀 Building Docker image..."
	@docker build -t pong-rush-api . > /dev/null

run:
	@echo "▶️ Running Docker container..."
	@docker run -p 3000:3000 --rm --name pong-rush-api -it pong-rush-api

clean:
	@echo "🧹 Removing Docker container..."
	@docker rm -f pong-rush-api 2>/dev/null || true

fclean: clean
	@echo "🧨 Removing Docker image..."
	@docker rmi -f pong-rush-api 2>/dev/null || true

full_clean:
	@echo "⚠️ Removing all containers, images, and pruning system..."
	@docker rm -f $$(docker ps -aq) 2>/dev/null || true
	@docker rmi -f $$(docker images -q) 2>/dev/null || true
	@docker system prune -f

re: fclean all
