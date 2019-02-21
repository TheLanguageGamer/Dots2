
#include <vector>
#include <functional>
#include <random>
#include <stdio.h>
#include <SDL/SDL_gfxPrimitives.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

std::random_device rd;
std::mt19937 rng(rd()); 

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

struct Vector2Int
{
	int32_t x;
	int32_t y;
	Vector2Int()
	: x(0)
	, y(0) {}
	Vector2Int(int32_t x, int32_t y)
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

static Entity createCircle(float x, float y, float radius, uint32_t color)
{
	return Entity(Type::Circle, Vector2(x, y), Vector2(radius*2.0, radius*2.0), color);
}

struct Screen
{
	std::vector<Entity> entities;
	Vector2 screenSize;
	uint32_t bgColor;
	Screen(Vector2 screenSize, uint32_t bgColor)
	: screenSize(screenSize)
	, bgColor(bgColor) {}
	Screen() {}
	virtual void loop(double currentTime) {}
	virtual void onKeyUp(SDL_Keycode key) {}
	virtual void onKeyDown(SDL_Keycode key) {}
};

struct Game
{
	Screen* screen;
	Vector2 screenSize;
	uint32_t bgColor;
	Game(Vector2 screenSize, uint32_t bgColor)
	: screenSize(screenSize)
	, bgColor(bgColor)
	, screen(nullptr) {}

	void setScreen(Screen* s) { screen = s;}

	void render(SDL_Surface* surface, double currentTime, uint64_t count)
	{
		std::vector<Entity>& entities = screen->entities;
		boxColor(surface, 0, 0, screenSize.x, screenSize.y, bgColor);
		for (int64_t i = 0; i < entities.size(); ++i)
		{
			const Entity& entity = entities[i];
			switch(entity.type)
			{
				case Type::Circle:
				{
					filledEllipseColor(surface,
						entity.position.x,
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

	void loop(SDL_Surface* surface, double currentTime, uint64_t count)
	{
		screen->loop(currentTime);
		render(surface, currentTime, count);
	}

	void onKeyUp(SDL_Keycode key)
	{
		screen->onKeyUp(key);
	}

	void onKeyDown(SDL_Keycode key)
	{
		screen->onKeyDown(key);
	}
};

struct Grid
{
	Vector2Int matrixSize;
	Vector2 screenSize;
	int32_t startIndex;
	std::vector<uint32_t> stateColors;
	Grid(Vector2Int matrixSize,
		 Vector2 screenSize,
		 Vector2 cellSize,
		 float cellPadding,
		 std::vector<Entity>& entities)
	: matrixSize(matrixSize)
	, screenSize(screenSize)
	, startIndex(entities.size())
	{

		for (int32_t i = 0; i < matrixSize.x; ++i)
		{
			for( int32_t j = 0; j < matrixSize.y; ++j)
			{
				float x = i*cellSize.x + cellSize.x/2;
				float y = j*cellSize.y + cellSize.y/2;
				entities.push_back(createCircle(x, y, cellSize.x/2.0-cellPadding/2.0, 0xddddddff));
				entities.push_back(createCircle(x+2.5, y+1.5, cellSize.x/2.0-cellPadding/2.0, 0x0));
			}
		}
	}
	Grid()
	: startIndex(-1) {}

	uint32_t getCellIndex(uint32_t row, uint32_t column)
	{
		uint32_t index = startIndex + 2*matrixSize.y*column + 2*row + 1;
		return index;
	}

	uint32_t getCell(uint32_t row, uint32_t column, std::vector<Entity>& entities)
	{
		return entities[getCellIndex(row, column)].color;
	}

	void setCell(uint32_t row, uint32_t column, uint32_t state, std::vector<Entity>& entities)
	{
		entities[getCellIndex(row, column)].color = state;
	}

	void stamp(
		std::vector<std::vector<uint32_t>> shape,
		Vector2Int offset,
		std::vector<Entity>& entities)
	{
		for (int32_t row = 0; row < shape.size(); ++row)
		{

			for (int32_t column = 0; column < shape[row].size(); ++column)
			{
				setCell(row+offset.y, column+offset.x, shape[row][column], entities);
			}
		}
	}
};

struct PlayTetris : Screen
{
	double period;
	double lastDrop;
	Grid grid;
	std::vector<std::vector<std::vector<uint32_t>>> shapes;
	std::vector<std::vector<uint32_t>> currentShape;
	Vector2Int currentOffset;
	std::uniform_int_distribution<uint32_t> uniformDistribution;
	enum State
	{
		Empty = 0x0,
		Falling = 0xff9900ff,
		Grounded = 0x00cc66ff
	};
	PlayTetris(Vector2 screenSize, uint32_t bgColor)
	: Screen(screenSize, bgColor)
	, period(200.0)
	, lastDrop(0.0)
	, uniformDistribution(0, 0)
	, currentOffset(0, 0)
	{
		grid = Grid(
			Vector2Int(10, 24),
			screenSize,
			Vector2(15, 15),
			2.0f,
			entities);

		shapes = std::vector<std::vector<std::vector<uint32_t>>>({
			{
				{State::Empty, State::Falling, State::Empty, State::Empty},
				{State::Empty, State::Falling, State::Empty, State::Empty},
				{State::Empty, State::Falling, State::Falling, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
			{
				{State::Empty, State::Empty, State::Falling, State::Empty},
				{State::Empty, State::Empty, State::Falling, State::Empty},
				{State::Empty, State::Falling, State::Falling, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
			{
				{State::Empty, State::Empty, State::Empty, State::Empty},
				{State::Empty, State::Falling, State::Empty, State::Empty},
				{State::Falling, State::Falling, State::Falling, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
			{
				{State::Empty, State::Empty, State::Empty, State::Empty},
				{State::Falling, State::Falling, State::Empty, State::Empty},
				{State::Empty, State::Falling, State::Falling, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
			{
				{State::Empty, State::Empty, State::Empty, State::Empty},
				{State::Empty, State::Falling, State::Falling, State::Empty},
				{State::Falling, State::Falling, State::Empty, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
			{
				{State::Empty, State::Empty, State::Empty, State::Empty},
				{State::Empty, State::Falling, State::Falling, State::Empty},
				{State::Empty, State::Falling, State::Falling, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
			{
				{State::Empty, State::Empty, State::Empty, State::Empty},
				{State::Empty, State::Empty, State::Empty, State::Empty},
				{State::Falling, State::Falling, State::Falling, State::Falling},
				{State::Empty, State::Empty, State::Empty, State::Empty},
			},
		});
		uniformDistribution = std::uniform_int_distribution<uint32_t>(0, shapes.size()-1);

		stampRandomShape();
	}
	void stampRandomShape()
	{
		currentOffset = Vector2Int(3, 0);
		auto shape = shapes[uniformDistribution(rng)];
		grid.stamp(shape, currentOffset, entities);
		currentShape = shape;
	}
	void ground()
	{
		for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = currentState != State::Empty ? State::Grounded : State::Empty;	
				grid.setCell(row, column, newState, entities);
			}
		}
	}
	void clearRows()
	{
		for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
		{
			bool isFilled = true;
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t state = grid.getCell(row, column, entities);
				isFilled = isFilled && state == State::Grounded;
			}
			if (isFilled)
			{
				for (int32_t column = 0; column < grid.matrixSize.x; ++column)
				{
					grid.setCell(row, column, State::Empty, entities);
				}
				moveDown(row, State::Grounded);
			}
		}
	}
	bool canMoveDown()
	{
		for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
		{
			for(int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t aboveState = row > 0 ? grid.getCell(row-1, column, entities) : State::Empty;
				uint32_t currentState = grid.getCell(row, column, entities);
				if ((aboveState == State::Falling && currentState == State::Grounded)
					|| (row == grid.matrixSize.y-1 && currentState == State::Falling))
				{
					return false;
				}
			}
		}
		return true;
	}
	bool canMoveLeft()
	{
		for(int32_t column = 0; column < grid.matrixSize.x; ++column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column < grid.matrixSize.x-1 ? grid.getCell(row, column+1, entities) : State::Empty;
				if ((newState == State::Falling && currentState == State::Grounded)
					|| (column == 0 && currentState == State::Falling))
				{
					return false;
				}
			}
		}
		return true;
	}
	bool canMoveRight()
	{
		for(int32_t column = grid.matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column > 0 ? grid.getCell(row, column-1, entities) : State::Empty;
				if ((newState == State::Falling && currentState == State::Grounded)
					|| (column == grid.matrixSize.x-1 && currentState == State::Falling))
				{
					return false;
				}
			}
		}
		return true;
	}
	void moveDown(int32_t fromRow = -1, uint32_t movingState = State::Falling)
	{
		fromRow = fromRow < 0 ? grid.matrixSize.y-1 : fromRow;
		for (int32_t row = fromRow; row >= 0; --row)
		{
			for(int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = row > 0 ? grid.getCell(row-1, column, entities) : State::Empty;
				if (newState != movingState && currentState != movingState)
				{
					continue;
				}
				grid.setCell(row, column, newState, entities);
			}
		}
		currentOffset.y += 1;
	}
	void moveLeft()
	{
		for(int32_t column = 0; column < grid.matrixSize.x; ++column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column < grid.matrixSize.x-1 ? grid.getCell(row, column+1, entities) : State::Empty;
				if (newState != State::Falling && currentState != State::Falling)
				{
					continue;
				}
				grid.setCell(row, column, newState, entities);
			}
		}
		currentOffset.x -= 1;
	}
	void moveRight()
	{
		for(int32_t column = grid.matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column > 0 ? grid.getCell(row, column-1, entities) : State::Empty;
				if (newState != State::Falling && currentState != State::Falling)
				{
					continue;
				}
				grid.setCell(row, column, newState, entities);
			}
		}
		currentOffset.x += 1;
	}
	void rotate()
	{
		Vector2Int co = currentOffset;
		for(int32_t x = 0; x < 2; ++x)
		{
			for (int32_t y = x; y < 4-x-1; ++y)
			{
				uint32_t tempState = grid.getCell(co.y + y, co.x + x, entities);

				grid.setCell(co.y + y, co.x + x, grid.getCell(co.y + 4 - 1 - x, co.x + y, entities), entities);
				grid.setCell(co.y + 4 - 1 - x, co.x + y, grid.getCell(co.y + 4 - 1 - y, co.x + 4 - 1 - x, entities), entities);
				grid.setCell(co.y + 4 - 1 - y, co.x + 4 - 1 - x, grid.getCell(co.y + x, co.x + 4 - 1 - y, entities), entities);
				grid.setCell(co.y + x, co.x + 4 - 1 - y, tempState, entities);
			}
		}
	}
	bool isCoordinateFree(int32_t y, int32_t x)
	{
		if (x < 0 || y < 0 || x >= grid.matrixSize.x || y >= grid.matrixSize.y)
		{
			printf("return false %d x %d\n", x, y);
			return false;
		}
		uint32_t state = grid.getCell(y, x, entities);
		return state != State::Grounded;
	}
	bool canRotate()
	{
		Vector2Int co = currentOffset;
		for(int32_t x = 0; x < 2; ++x)
		{
			for (int32_t y = x; y < 4-x-1; ++y)
			{
				bool isFree = isCoordinateFree(co.y + y, co.x + x)
					&& isCoordinateFree(co.y + 4 - 1 - x, co.x + y)
					&& isCoordinateFree(co.y + 4 - 1 - y, co.x + 4 - 1 - x)
					&& isCoordinateFree(co.y + x, co.x + 4 - 1 - y);
				if (!isFree)
				{
					return false;
				}
			}
		}
		return true;
	}
	void loop(double currentTime) override
	{
		if (currentTime - lastDrop > period)
		{
			if (!canMoveDown())
			{
				ground();
				clearRows();
				stampRandomShape();
			}
			else
			{
				moveDown();
			}
			lastDrop = currentTime;
		}
	}
	void onKeyDown(SDL_Keycode key) override
	{
		switch (key)
		{
			case SDLK_LEFT:
			{
				if (canMoveLeft())
				{
					moveLeft();
				}
				break;
			}
			case SDLK_RIGHT:
			{
				if (canMoveRight())
				{
					moveRight();
				}
				break;
			}
			case SDLK_UP:
			{
				if (canRotate())
				{
					rotate();
				}
			}
			default:
			{
				break;
			}
		}
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Vector2 screenSize(400, 400);
	Game game(screenSize, 0xffffffff);
	PlayTetris* playTetris = new PlayTetris(screenSize, 0xffffffff);
	game.setScreen(playTetris);

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

