#include "Engine.h"

struct Emoter : Screen
{
	Emoter(Vector2 screenSize,
		   uint32_t bgColor,
		   std::vector<Entity>& entities)
	: Screen(screenSize, bgColor, entities)
	{
		//entities.push_back(createCircle(50, 50, 50, 0x000000ff));
		entities.push_back(createArc(Vector2(150, 50), Vector2(0, 1.67), 60, 5, 0x000000ff));
	}

	bool loop(double currentTime, const std::vector<bool>& keyStates)
	{
		return false; 
	}
	void onKeyUp(SDL_Keycode key)
	{
	}
	void onKeyDown(SDL_Keycode key)
	{
	}
	void onMouseButton1Down(const Vector2 position)
	{
	}
	void onMouseButton1Up(const Vector2 position)
	{
	}
	void onFocusLost()
	{
	}
	void onLayout(const Vector2& parentPosition, const Vector2& parentSize)
	{
	}
	void reset()
	{
	}
};

EM_JS(float, getWindowWidth, (), {
	var w = window,
	    d = document,
	    e = d.documentElement,
	    g = d.getElementsByTagName('body')[0],
	    x = w.innerWidth || e.clientWidth || g.clientWidth;
	return x;
});

EM_JS(float, getWindowHeight, (), {
	var w = window,
	    d = document,
	    e = d.documentElement,
	    g = d.getElementsByTagName('body')[0],
	    y = w.innerHeight|| e.clientHeight|| g.clientHeight;
	return y;
});

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	float windowWidth = getWindowWidth();
	float windowHeight = getWindowHeight();
	printf("%4.2f x %4.2f\n", windowWidth, windowHeight);
	Vector2 screenSize(windowWidth, windowHeight);
	Game game(screenSize, 0xffffffff);
	std::vector<Entity> entities;
	Emoter* emoter = new Emoter(screenSize, 0xffffffff, entities);
	game.setScreen(emoter);
	emoter->onLayout(Vector2(), screenSize);

	SDL_Init(SDL_INIT_VIDEO);

	SDL_Surface* surface = SDL_SetVideoMode(screenSize.x, screenSize.y, 32, SDL_SWSURFACE);
	
	uint64_t count = 0;
	double lastTime = emscripten_get_now();
	loop = [&]
	{
		SDL_Event e;
		while(SDL_PollEvent(&e))
		{
			switch (e.type)
			{
				case SDL_QUIT:
				{
					std::terminate();
					break;
				}
				case SDL_KEYUP:
				{
					game.onKeyUp(e.key.keysym.sym);
					break;
				}
				case SDL_KEYDOWN:
				{
					game.onKeyDown(e.key.keysym.sym);
					break;
				}
				case SDL_MOUSEBUTTONDOWN:
				{
					SDL_MouseButtonEvent *m = (SDL_MouseButtonEvent*)&e;
					//printf("button down: %d,%d  %d,%d\n", m->button, m->state, m->x, m->y);
					game.onMouseButton1Down(Vector2(m->x, m->y));
					break;
				}
				case SDL_MOUSEBUTTONUP:
				{
					SDL_MouseButtonEvent *m = (SDL_MouseButtonEvent*)&e;
					//printf("button up: %d,%d  %d,%d\n", m->button, m->state, m->x, m->y);
					game.onMouseButton1Up(Vector2(m->x, m->y));
					break;
				}
				case SDL_WINDOWEVENT:
				{
					SDL_WindowEvent *w = (SDL_WindowEvent*)&e;
					printf("window event %u %u\n", w->type, w->event);
					if (w->event == SDL_WINDOWEVENT_FOCUS_LOST)
					{
						game.onFocusLost();
					}
					break;
				}
				default:
				{
					break;
				}
			}
		}

		count += 1;
		double currentTime = emscripten_get_now();
		game.loop(surface, currentTime, count);
		lastTime = currentTime;
	};

	emscripten_set_main_loop(main_loop, 0, true);

	SDL_Quit();

	return 1;
}

