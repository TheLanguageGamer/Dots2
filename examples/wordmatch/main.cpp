#include "Engine.h"

#define PI 3.14159265359

struct Word
{
	std::string text;
	std::string pronunciation;
	std::string translation;

	Word(std::string text, std::string pronunciation, std::string translation)
	: text(text)
	, pronunciation(pronunciation)
	, translation(translation) {}
};

struct TextTile : Component
{
	float selectDelta;
	uint32_t backgroundIndex;
	uint32_t foregroundIndex;
	uint32_t imageIndex;
	uint32_t textIndex;

	TextTile(const std::string& text,
			 const Vector2& offsetSize,
			 const Vector2& offsetPosition,
			 const Vector2& anchorPoint,
			 const float fontSize,
			 std::vector<Entity>& entities)
	: Component()
	, selectDelta(2.0)
	{
		this->offsetSize = offsetSize;
		this->offsetPosition = offsetPosition;
		this->anchorPoint = anchorPoint;

		backgroundIndex = entities.size();
		entities.push_back(createRoundedRect(
			offsetPosition,
			offsetSize,
			10.0f,
			2.0f,
			0x323232ff,
			0x969696ff
		));
		foregroundIndex = entities.size();
		entities.push_back(createRoundedRect(
			Vector2(offsetPosition.x + 4, offsetPosition.y + 4),
			offsetSize,
			10.0f,
			2.0f,
			0x323232ff,
			0xe8e8e8ff
		));
		textIndex = entities.size();
		entities.push_back(createText(
			text,
			offsetPosition.x + 10,
			offsetPosition.y + 44,
			40,
			0x000000ff
			//0x0
		));

		indexSpan = Vector2Int(backgroundIndex, textIndex);
	}

	void onSelect(uint32_t color, std::vector<Entity>& entities) override
	{
		entities[foregroundIndex].id = color;
		Vector2 currentForeground = entities[foregroundIndex].position;
		entities[foregroundIndex].position = Vector2(currentForeground.x - selectDelta, currentForeground.y - selectDelta);
		Vector2 currentText = entities[textIndex].position;
		entities[textIndex].position = Vector2(currentText.x - selectDelta, currentText.y - selectDelta);

		animateSizeScale(2.0, 50, Vector2(), entities);
	}

	void deselect(std::vector<Entity>& entities) override
	{
		entities[foregroundIndex].id = 0xe8e8e8ff;
		Vector2 currentForeground = entities[foregroundIndex].position;
		entities[foregroundIndex].position = Vector2(currentForeground.x + selectDelta, currentForeground.y + selectDelta);
		Vector2 currentText = entities[textIndex].position;
		entities[textIndex].position = Vector2(currentText.x + selectDelta, currentText.y + selectDelta);
	}

	uint32_t getCategory(std::vector<Entity>& entities) override
	{
		return entities[textIndex].id;
	}
};

struct Equation : Screen
{
	ComponentGrid grid;
	std::uniform_int_distribution<uint32_t> wordPrDist;
	
	Equation(Vector2 screenSize,
		   uint32_t bgColor,
		   std::vector<Entity>& entities)
	: Screen(screenSize, bgColor, entities)
	{

		std::vector<Word> fruit({
			Word("苹果","píng guǒ", "apple"),
			Word("香蕉","xiāng jiāo", "banana"),
			Word("芒果","máng guǒ", "mango"),
			Word("葡萄","pú táo", "grape"),
			Word("橙子", "chéng zǐ", "orange"),
			Word("草莓", "cǎo méi" , "strawberry"),
			Word("西瓜", "xī guā", "melon"),
			Word("樱桃", "yīng táo", "cherry"),
			Word("柑橘", "gān jú", "mandarin"),
			Word("桃子", "táo zǐ", "peach"),
			Word("梨", "lí", "pear"),
			Word("蓝莓", "lán méi"   , "blueberry"),
			Word("椰子", "yē zǐ", "coconut"),
			Word("奇异果", "qí yì guǒ", "kiwi"),
			Word("柠檬", "níng méng", "lemon"),
			Word("牛油果", "niú yóu guǒ", "avocado"),
			Word("菠萝", "bō luó", "pineapple"),
			Word("石榴", "shí liú", "pomegranate"),
		});

		wordPrDist = std::uniform_int_distribution<uint32_t>(0, 4);

		Vector2 tileSize(135, 75);

		grid = ComponentGrid(
			Vector2(0.5, 0.5),
			Vector2(0.0, 0.0),
			Vector2(0.8, 0.8),
			Vector2(0.0, 0.0),
			Vector2(0.5, 0.5),
			Vector2Int(5, 5),
			Vector2(tileSize.x + 8, tileSize.y + 8),
			false,
			[this, &fruit, &entities, &tileSize](int32_t i, int32_t j, float x, float y){
				Word& word = fruit[wordPrDist(rng)];
				return std::make_shared<TextTile>(
					word.text,
					tileSize,
					Vector2(x, y),
					Vector2(0, 0),
					40,
					entities
				);
			},
			entities
		);
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
		printf("wordmatch onMouseButton1Down\n");
		grid.onMouseButton1Down(position, entities);
	}
	void onMouseButton1Up(const Vector2 position)
	{
		grid.onMouseButton1Up(position, entities);
	}
	void onMouseMove(const Vector2 position)
	{
		grid.onMouseMove(position, entities);
	}
	void onFocusLost()
	{
	}
	void onLayout(const Vector2& parentPosition, const Vector2& parentSize)
	{
		grid.onLayout(parentPosition, parentSize, entities);
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
	Engine_Init();
	float windowWidth = getWindowWidth();
	float windowHeight = getWindowHeight();
	printf("%4.2f x %4.2f\n", windowWidth, windowHeight);
	Vector2 screenSize(windowWidth, windowHeight);
	Game game(screenSize, 0xffffffff);
	std::vector<Entity> entities;
	Equation* equation = new Equation(screenSize, 0xffffffff, entities);
	game.setScreen(equation);
	equation->onLayout(Vector2(), screenSize);

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
				case SDL_MOUSEMOTION:
				{
					SDL_MouseMotionEvent *m = (SDL_MouseMotionEvent*)&e;
					//printf("mouse move: %d,%d\n", m->x, m->y);
					game.onMouseMove(Vector2(m->x, m->y));
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
