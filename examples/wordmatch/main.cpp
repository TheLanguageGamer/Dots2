#include "Engine.h"

#define PI 3.14159265359

struct Word
{
	std::string text;
	std::string pronunciation;
	std::string translation;
	std::string imageFileName;

	Word(
		std::string text,
		std::string pronunciation,
		std::string translation,
		std::string imageFileName)
	: text(text)
	, pronunciation(pronunciation)
	, translation(translation)
	, imageFileName(imageFileName) {}
};

struct TextTile : Component
{
	Word word;
	float selectDelta;
	uint32_t backgroundIndex;
	uint32_t foregroundIndex;
	uint32_t imageIndex;
	uint32_t textIndex;

	TextTile(const Word& word,
			 const Vector2& offsetSize,
			 const Vector2& offsetPosition,
			 const Vector2& anchorPoint,
			 const float fontSize,
			 std::vector<Entity>& entities)
	: Component()
	, word(word)
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
		imageIndex = entities.size();
		entities.push_back(createImage(
			//"red_apple.svg",
			word.imageFileName,
			offsetPosition,
			offsetSize,
			0xffffff00
		));
		textIndex = entities.size();
		entities.push_back(createText(
			word.text,
			offsetPosition.x + 10,
			offsetPosition.y + 44,
			40,
			0x000000ff
			//0x0
		));

		indexSpan = Vector2Int(backgroundIndex, textIndex);
		backgroundIndex = 0;
		foregroundIndex = 1;
		imageIndex = 2;
		textIndex = 3;
	}

	void onSelect(uint32_t color, std::vector<Entity>& entities) override
	{
		entities[indexSpan.x + foregroundIndex].id = color;
		Vector2 currentForeground = entities[indexSpan.x + foregroundIndex].position;
		entities[indexSpan.x + foregroundIndex].position = Vector2(currentForeground.x - selectDelta, currentForeground.y - selectDelta);
		Vector2 currentText = entities[indexSpan.x + textIndex].position;
		entities[indexSpan.x + textIndex].position = Vector2(currentText.x - selectDelta, currentText.y - selectDelta);
		entities[indexSpan.x + textIndex].rgba &= 0xffffff00;
		entities[indexSpan.x + imageIndex].rgba = 0xffffffff;
	}

	void deselect(std::vector<Entity>& entities) override
	{
		entities[indexSpan.x + foregroundIndex].id = 0xe8e8e8ff;
		Vector2 currentForeground = entities[indexSpan.x + foregroundIndex].position;
		entities[indexSpan.x + foregroundIndex].position = Vector2(currentForeground.x + selectDelta, currentForeground.y + selectDelta);
		Vector2 currentText = entities[indexSpan.x + textIndex].position;
		entities[indexSpan.x + textIndex].position = Vector2(currentText.x + selectDelta, currentText.y + selectDelta);
		entities[indexSpan.x + textIndex].rgba |= 0x000000ff;
		entities[indexSpan.x + imageIndex].rgba = 0xffffff00;
	}

	uint32_t getCategory(std::vector<Entity>& entities) override
	{
		return entities[indexSpan.x + textIndex].id;
	}
};

struct Matcher : Screen
{
	ComponentGrid grid;
	std::uniform_int_distribution<uint32_t> wordPrDist;
	
	Matcher(Vector2 screenSize,
		   uint32_t bgColor,
		   std::vector<Entity>& entities)
	: Screen(screenSize, bgColor, entities)
	{

		std::vector<Word> fruit({
			Word("苹果","píng guǒ", "apple", "red_apple.svg"),
			Word("香蕉","xiāng jiāo", "banana", "bananas.svg"),
			//Word("芒果","máng guǒ", "mango"),
			Word("葡萄","pú táo", "grape", "grapes.svg"),
			Word("橙子", "chéng zǐ", "orange", "orange.png"),
			Word("草莓", "cǎo méi" , "strawberry", "strawberry.png"),
			// Word("西瓜", "xī guā", "melon"),
			Word("樱桃", "yīng táo", "cherry", "cherry.svg"),
			// Word("柑橘", "gān jú", "mandarin"),
			// Word("桃子", "táo zǐ", "peach"),
			Word("梨", "lí", "pear", "pear.svg"),
			// Word("蓝莓", "lán méi"   , "blueberry"),
			Word("椰子", "yē zǐ", "coconut", "coconut.png"),
			Word("奇异果", "qí yì guǒ", "kiwi", "kiwi.png"),
			Word("柠檬", "níng méng", "lemon", "lemon.png"),
			Word("牛油果", "niú yóu guǒ", "avocado", "avocado.png"),
			Word("菠萝", "bō luó", "pineapple", "pineapple.png"),
			// Word("石榴", "shí liú", "pomegranate"),

			Word("玉米",	"yù mǐ", "corn", "corn.svg"),
			Word("土豆", "tǔ dòu", "potato", "potato.png"),
			Word("生姜", "shēng jiāng", "ginger", "ginger.png"),
			Word("大蒜", "dà suàn", "garlic", "garlic.png"),
			// Word("豆", "dòu"	, "bean"),
			Word("西兰花", "xī lán huā", "broccoli", "broccoli.png"),
			// Word("黄瓜", "huáng guā", "cucumber"),
			// Word("韭菜", "jiǔ cài", "leek"),
			// Word("蘑菇", "mó gū", "mushroom"),
			// Word("木耳", "mù ěr", "agarics"),
			// Word("青椒", "qīng jiāo", "green pepper"),
			// Word("辣椒", "là jiāo", "pepper"),
			// Word("西红柿", "xī hóng shì", "tomato"),
			// Word("茄子", "qié zǐ", "aborigine"),
			// Word("萝卜", "luó bo", "radish"),
			// Word("芋头", "yù tóu", "taro"),
			// Word("白菜", "bái cài", "cabbage"),
			// Word("菠菜", "bō cài", "spinach"),
			// Word("南瓜", "nán guā", "pumpkin"),
			// Word("苦瓜", "kǔ guā", "bitter gourd"),
		});

		wordPrDist = std::uniform_int_distribution<uint32_t>(0, 2);

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
					word,
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
	Matcher* matcher = new Matcher(screenSize, 0xffffffff, entities);
	game.setScreen(matcher);
	matcher->onLayout(Vector2(), screenSize);

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

