
#include <vector>
#include <functional>
#include <stdio.h>
#include <SDL/SDL_gfxPrimitives.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

struct Vector2
{
	float x;
	float y;
	Vector2()
	: x(0.0)
	, y(0.0) {}
	Vector2(float x, float y)
	: x(x)
	, y(y) {}
};

enum Type
{
	Circle
};

struct Entity
{
	Vector2 position;
	Vector2 size;
	uint32_t color;
	Type type;
	Entity(Type type, Vector2 position, Vector2 size, uint32_t color)
	: type(type)
	, position(position)
	, size(size)
	, color(color) {}
};

struct Game
{
	std::vector<Entity> entities;
	int32_t width;
	int32_t height;
	uint32_t bgColor;
	Game(int32_t width, int32_t height, uint32_t bgColor)
	: width(width)
	, height(height)
	, bgColor(bgColor) {}

	void render(SDL_Surface* surface, double delta, uint64_t count)
	{
		boxColor(surface, 0, 0, width, height, bgColor);
		for (int64_t i = 0; i < entities.size(); ++i)
		{
			const Entity& entity = entities[i];
			switch(entity.type)
			{
				case Type::Circle:
				{
					filledEllipseColor(surface,
						entity.position.x + count,
						entity.position.y,
						entity.size.x/2.0,
						entity.size.y/2.0,
						entity.color);
					break;
				}
			}
		}
		SDL_UpdateRect(surface, 0, 0, 0, 0);
	}

	void loop(SDL_Surface* surface, double delta, uint64_t count)
	{
		render(surface, delta, count);
	}
};

static Entity createCircle(float x, float y, float radius, uint32_t color)
{
	return Entity(Type::Circle, Vector2(x, y), Vector2(radius*2.0, radius*2.0), color);
}

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game(400, 400, 0xffffffff);
	for (float i = 0; i < 1000; ++i)
	{
		game.entities.push_back(createCircle(i/2, i/2, 30, 0x0000ffff));
	}

	SDL_Init(SDL_INIT_VIDEO);

	SDL_Surface* surface = SDL_SetVideoMode(game.width, game.height, 32, SDL_SWSURFACE);
	
	uint64_t count = 0;
	double lastTime = emscripten_get_now();
	loop = [&]
	{
		SDL_Event e;
		while(SDL_PollEvent(&e))
		{
			if(e.type == SDL_QUIT) std::terminate();
		}

		count += 1;
		double currentTime = emscripten_get_now();
		double delta = currentTime - lastTime;
		game.loop(surface, delta, count);
		lastTime = currentTime;
	};

	emscripten_set_main_loop(main_loop, 0, true);

	SDL_Quit();

	return 1;
}

