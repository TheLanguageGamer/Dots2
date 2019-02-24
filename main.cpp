
#include <vector>
#include <unordered_map>
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

static bool doesPointIntersectRect(const Vector2& point,
								   const Vector2& rectPosition,
								   const Vector2& rectSize)
{
	return point.x >= rectPosition.x
		   && point.x <= rectPosition.x + rectSize.x
		   && point.y >= rectPosition.y
		   && point.y <= rectPosition.y + rectSize.y; 
}

enum Type
{
	Circle,
	Rectangle,
	Text
};

std::vector<std::string> idToString;
std::unordered_map<std::string, uint32_t> stringToId;

struct Entity
{
	Vector2 position;
	Vector2 size;
	uint32_t color;
	uint32_t id;
	Type type;
	Entity(Type type, Vector2 position, Vector2 size, uint32_t color)
	: type(type)
	, position(position)
	, size(size)
	, color(color) {}
	Entity(Type type, Vector2 position, Vector2 size, uint32_t color, uint32_t id)
	: type(type)
	, position(position)
	, size(size)
	, color(color)
	, id(id) {}

	void shift(const Vector2& delta)
	{
		position.x += delta.x;
		position.y += delta.y;
	}
};

static Entity createCircle(float x, float y, float radius, uint32_t color)
{
	return Entity(Type::Circle, Vector2(x, y), Vector2(radius*2.0, radius*2.0), color);
}

static Entity createRectangle(const Vector2& position, const Vector2& size, uint32_t color)
{
	return Entity(Type::Rectangle, position, size, color);
}

static uint32_t getIdForText(const std::string& text)
{
	if (stringToId.find(text) == stringToId.end())
	{
		uint32_t id = idToString.size();
		idToString.push_back(text);
		stringToId[text] = id;
	}
	return stringToId[text];
}

static const std::string& getTextForId(uint32_t id)
{
	return idToString[id];
}

static Entity createText(const std::string& text, float x, float y, float fontSize, uint32_t color)
{
	uint32_t id = getIdForText(text);
	return Entity(Type::Text, Vector2(x, y), Vector2(fontSize, fontSize), color, id);
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
	virtual void loop(double currentTime, const std::vector<bool>& keyStates) {}
	virtual void onKeyUp(SDL_Keycode key) {}
	virtual void onKeyDown(SDL_Keycode key) {}
	virtual void onMouseButton1Down(const Vector2 position) {}
	virtual void onMouseButton1Up(const Vector2 position) {}
	virtual void onLayout(const Vector2& parentPosition, const Vector2& parentSize) {}
};

struct Game
{
	Screen* screen;
	Vector2 screenSize;
	uint32_t bgColor;
	std::vector<bool> keyStates;
	Game(Vector2 screenSize, uint32_t bgColor)
	: screenSize(screenSize)
	, bgColor(bgColor)
	, screen(nullptr)
	, keyStates(std::vector<bool>(4096, false)) {}

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
						entity.position.x + entity.size.x/2.0,
						entity.position.y + entity.size.y/2.0,
						entity.size.x/2.0,
						entity.size.y/2.0,
						entity.color);
					break;
				}
				case Type::Rectangle:
				{
					boxColor(surface,
						entity.position.x,
						entity.position.y,
						entity.position.x + entity.size.x,
						entity.position.y + entity.size.y,
						entity.color);
					break;
				}
				case Type::Text:
				{
					const std::string& text = getTextForId(entity.id);
					filledTextColor(surface,
						text.c_str(),
						entity.position.x,
						entity.position.y,
						entity.color);
					break;
				}
			}
		}
		// std::string text("WHAT");
		// filledTextColor(surface, text.c_str(), 50, 50, 0x000000ff);
		SDL_UpdateRect(surface, 0, 0, 0, 0);
	}

	void loop(SDL_Surface* surface, double currentTime, uint64_t count)
	{
		screen->loop(currentTime, keyStates);
		render(surface, currentTime, count);
	}

	void onKeyUp(SDL_Keycode key)
	{
		keyStates[key] = false;
		screen->onKeyUp(key);
	}

	void onKeyDown(SDL_Keycode key)
	{
		keyStates[key] = true;
		screen->onKeyDown(key);
	}

	void onMouseButton1Down(const Vector2 position)
	{
		screen->onMouseButton1Down(position);
	}

	void onMouseButton1Up(const Vector2 position)
	{
		screen->onMouseButton1Up(position);
	}
};

struct Component
{
	Vector2 screenPosition;
	Vector2 screenSize;

	Vector2 relativePosition;
	Vector2 relativeSize;

	Vector2 offsetPosition;
	Vector2 offsetSize;

	Vector2 anchorPoint;
	float aspectRatio;

	Vector2Int indexSpan;
	Component()
	: screenPosition(Vector2())
	, screenSize(Vector2())
	, relativePosition(Vector2())
	, relativeSize(Vector2())
	, offsetPosition(Vector2())
	, offsetSize(Vector2())
	, anchorPoint(Vector2())
	, aspectRatio(-1.0f) {}
	Component(const Vector2& relativePosition,
 		 	  const Vector2& offsetPosition,
 		 	  const Vector2& relativeSize,
 		 	  const Vector2& offsetSize,
 		 	  const Vector2& anchorPoint)
	: relativePosition(relativePosition)
	, offsetPosition(offsetPosition)
	, relativeSize(relativeSize)
	, offsetSize(offsetSize)
	, anchorPoint(anchorPoint)
	, aspectRatio(-1.0f) {}

	void onLayout(const Vector2& parentPosition, const Vector2& parentSize, std::vector<Entity>& entities)
	{
		float newWidth = relativeSize.x*parentSize.x + offsetSize.x;
		float newHeight = relativeSize.y*parentSize.y + offsetSize.y;

		Vector2 newScreenSize = Vector2(newWidth, newHeight);
		if (aspectRatio > 0.0)
		{
			float aspectWidth = newHeight*aspectRatio;
			float aspectHeight = newWidth/aspectRatio;
			if (aspectWidth < newWidth)
			{
				newScreenSize = Vector2(aspectWidth, newHeight);
			}
			else
			{
				newScreenSize = Vector2(newWidth, aspectHeight);
			}
		}

		float newX = parentPosition.x + (parentPosition.x+parentSize.x)*relativePosition.x - anchorPoint.x*newScreenSize.x + offsetPosition.x;
		float newY = parentPosition.y + (parentPosition.x+parentSize.y)*relativePosition.y - anchorPoint.y*newScreenSize.y + offsetPosition.y;

		Vector2 newScreenPosition = Vector2(newX, newY);
		
		float deltaX = newScreenPosition.x - screenPosition.x;
		float deltaY = newScreenPosition.y - screenPosition.y;
		for (int32_t index = indexSpan.x; index <= indexSpan.y; ++index)
		{
			const Vector2& entityPosition = entities[index].position;
			const Vector2& entitySize = entities[index].size;
			float xPercentage = (entityPosition.x - screenPosition.x)/screenSize.x;
			float yPercentage = (entityPosition.y - screenPosition.y)/screenSize.y;
			float newX = newScreenPosition.x + xPercentage*newScreenSize.x;
			float newY = newScreenPosition.y + yPercentage*newScreenSize.y;

			entities[index].position = Vector2(newX, newY);

			float newWidth = (entitySize.x/screenSize.x)*newScreenSize.x;
			float newHeight = (entitySize.y/screenSize.y)*newScreenSize.y;

			entities[index].size = Vector2(newWidth, newHeight);
		}
		screenPosition = newScreenPosition;
		screenSize = newScreenSize;
	}
};

struct TextButton : Component
{
	uint32_t shadowIndex;
	uint32_t outerIndex;
	uint32_t innerIndex;
	uint32_t textIndex;
	float activationMargin;
	bool isDown;
	TextButton(const std::string& text,
			   const Vector2& relativePosition,
			   const Vector2& offsetPosition,
			   const Vector2& anchorPoint,
			   const float fontSize,
			   const uint32_t color,
			   std::vector<Entity>& entities)
	: Component()
	, shadowIndex(0)
	, outerIndex(0)
	, innerIndex(0)
	, textIndex(0)
	, activationMargin(0)
	, isDown(false)
	{
		static const float CROP = 0.6;

		this->relativePosition = relativePosition;
		this->offsetPosition = offsetPosition;
		this->anchorPoint = anchorPoint;
		
		float outerMargin = fontSize*0.06;

		float innerMargin = fontSize*0.1;
		uint64_t length = text.size();
		float innerX = outerMargin;
		float innerY = outerMargin;
		float innerWidth = length*fontSize*CROP + innerMargin*2.0;
		float innerHeight = fontSize*1.2;

		float outerWidth = innerWidth + outerMargin*2.0;
		float outerHeight = innerHeight + outerMargin*2.0;

		float margin = innerMargin + outerMargin;

		activationMargin = outerMargin*1.0;
		float shadowX = outerMargin*1.5;
		float shadowY = outerMargin*1.5;

		shadowIndex = entities.size();
		entities.push_back(createRectangle(Vector2(shadowX, shadowY), Vector2(outerWidth, outerHeight), 0xbbbbbbff));
		outerIndex = entities.size();
		entities.push_back(createRectangle(Vector2(), Vector2(outerWidth, outerHeight), 0x000000ff));
		innerIndex = entities.size();
		entities.push_back(createRectangle(Vector2(innerX, innerY), Vector2(innerWidth, innerHeight), color));
		textIndex = entities.size();
		entities.push_back(createText(text, margin, fontSize, fontSize, 0x000000ff));

		offsetSize = Vector2(outerWidth, outerHeight);
		screenSize = Vector2(outerWidth, outerHeight);
		indexSpan = Vector2Int(shadowIndex, textIndex);
	}

	TextButton()
	: shadowIndex(0)
	, outerIndex(0)
	, innerIndex(0)
	, textIndex(0)
	, activationMargin(0)
	, isDown(false) {}

	void onMouseButton1Down(const Vector2& mousePosition, std::vector<Entity>& entities)
	{
			printf("TextButton onMouseButton1Down\n");
		if (doesPointIntersectRect(mousePosition,
								   screenPosition,
								   screenSize))
		{
			printf("TextButton onMouseButton1Down\n");
			Vector2 delta(-activationMargin, -activationMargin);
			entities[outerIndex].shift(delta);
			entities[innerIndex].shift(delta);
			entities[textIndex].shift(delta);
			isDown = true;
		}
	}

	void onMouseButton1Up(const Vector2& mousePosition, std::vector<Entity>& entities)
	{
		if (isDown)
		{
			isDown = false;
			Vector2 delta(activationMargin, activationMargin);
			entities[outerIndex].shift(delta);
			entities[innerIndex].shift(delta);
			entities[textIndex].shift(delta);
			if (doesPointIntersectRect(mousePosition,
									   screenPosition,
									   screenSize))
			{
				printf("TextButton activation\n");
			}
		}
	}
};

struct Grid : Component
{
	Vector2Int matrixSize;

	std::vector<uint32_t> stateColors;
	Grid(const Vector2& relativePosition,
 		 const Vector2& offsetPosition,
 		 const Vector2& relativeSize,
 		 const Vector2& offsetSize,
 		 const Vector2& anchorPoint,
 		 Vector2Int matrixSize,
		 Vector2 cellSize,
		 float cellPadding,
		 std::vector<Entity>& entities)
	: Component(relativePosition, offsetPosition, relativeSize, offsetSize, anchorPoint)
	, matrixSize(matrixSize)
	{
		int32_t startIndex = entities.size();
		for (int32_t i = 0; i < matrixSize.x; ++i)
		{
			for( int32_t j = 0; j < matrixSize.y; ++j)
			{
				float x = i*cellSize.x + cellSize.x/2;
				float y = j*cellSize.y + cellSize.y/2;
				entities.push_back(createCircle(x, y, cellSize.x/2.0-cellPadding/2.0, 0xddddddff));
				entities.push_back(createCircle(x+0.75*cellPadding, y+0.5*cellPadding, cellSize.x/2.0-cellPadding/2.0, 0x0));
			}
		}
		int32_t endIndex = entities.size() - 1;
		indexSpan = Vector2Int(startIndex, endIndex);
		screenSize = Vector2(matrixSize.x*cellSize.x, matrixSize.y*cellSize.y);
		aspectRatio = (float)matrixSize.x/(float)matrixSize.y;
	}
	Grid() {}

	uint32_t getCellIndex(uint32_t row, uint32_t column)
	{
		uint32_t index = indexSpan.x + 2*matrixSize.y*column + 2*row + 1;
		return index;
	}

	uint32_t getCellBackgroundIndex(uint32_t row, uint32_t column)
	{
		uint32_t index = indexSpan.x + 2*matrixSize.y*column + 2*row;
		return index;
	}

	uint32_t getCell(uint32_t row, uint32_t column, std::vector<Entity>& entities)
	{
		return (entities[getCellIndex(row, column)].color) >> 8;
	}

	uint32_t getCellVisibility(uint32_t row, uint32_t column, std::vector<Entity>& entities)
	{
		uint32_t color = entities[getCellBackgroundIndex(row, column)].color;
		return color & 0xff;
	}

	void setCellVisibility(uint32_t row, uint32_t column, uint32_t visibility, std::vector<Entity>& entities)
	{
		uint32_t bgColor = entities[getCellBackgroundIndex(row, column)].color;
		uint32_t cellColor = entities[getCellIndex(row, column)].color;
		uint32_t newBgColor = (bgColor & 0xffffff00) | visibility;
		uint32_t newCellColor = (cellColor & 0xffffff00) | visibility;
		entities[getCellBackgroundIndex(row, column)].color = newBgColor;
		entities[getCellIndex(row, column)].color = newCellColor;
	}

	void setCell(uint32_t row, uint32_t column, uint32_t state, std::vector<Entity>& entities)
	{
		uint32_t color = entities[getCellIndex(row, column)].color;
		uint32_t visibility = color & 0xff;
		uint32_t newVisibility = state > 0 ? getCellVisibility(row, column, entities) : 0x0;
		uint32_t newColor = (state << 8) | newVisibility;
		entities[getCellIndex(row, column)].color = newColor;
		//printf("Cell set to: %u\n", newColor);
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

	bool isValidCoordinate(Vector2Int a)
	{
		return a.x >= 0 && a.y >= 0 && a.x < matrixSize.x && a.y < matrixSize.y;
	}
};

struct PlayTetris : Screen
{
	double period;
	double lastDrop;
	Grid grid;
	TextButton pauseButton;
	std::vector<std::vector<std::vector<uint32_t>>> shapes;
	std::vector<std::vector<uint32_t>> currentShape;
	Vector2Int currentOffset;
	std::uniform_int_distribution<uint32_t> uniformDistribution;
	enum State
	{
		Empty = 0x0,
		Falling = 0xff9900,
		Grounded = 0x00cc66
	};
	PlayTetris(Vector2 screenSize, uint32_t bgColor)
	: Screen(screenSize, bgColor)
	, period(200.0)
	, lastDrop(0.0)
	, uniformDistribution(0, 0)
	, currentOffset(0, 0)
	{
		 // const Vector2& relativePosition,
 		//  const Vector2& offsetPosition,
 		//  const Vector2& relativeSize,
 		//  const Vector2& offsetSize,
 		//  const Vector2& anchorPoint,
 		//  Vector2Int matrixSize,
		 // Vector2 cellSize,
		 // float cellPadding,
		 // std::vector<Entity>& entities
		grid = Grid(Vector2(0.5, 0.5),
					Vector2(0.0, 0.0),
					Vector2(0.5, 0.8),
					Vector2(0.0, 0.0),
					Vector2(0.5, 0.5),
					Vector2Int(10, 24),
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

		pauseButton = TextButton("PAUSE",
								 Vector2(1.0,  0.0),
								 Vector2(-10.0, 10.0),
								 Vector2(1.0, 0.0),
								 30,
								 0xaaaaffff,
								 entities);

		entities.push_back(createCircle(0.0, 0.0, 30.0, 0x6666ffff));


		for (int32_t row = 0; row < 3; ++row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				grid.setCellVisibility(row, column, 0x0, entities);
			}
		}

		stampRandomShape();
	}
	void stampRandomShape()
	{
		currentOffset = Vector2Int(grid.matrixSize.x/2-2, 0);
		auto shape = shapes[uniformDistribution(rng)];
		//auto shape = shapes[6];
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
				row += 1;
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
				if (currentState == movingState && newState != movingState)
				{
					newState = State::Empty;
				}
				if ((currentState == movingState && newState == State::Empty)
					|| (currentState == State::Empty && newState == movingState))
				{
					grid.setCell(row, column, newState, entities);
				}
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
				if (currentState == State::Falling && newState == State::Grounded)
				{
					newState = State::Empty;
				}
				if ((currentState == State::Falling && newState == State::Empty)
					|| (currentState == State::Empty && newState == State::Falling))
				{
					grid.setCell(row, column, newState, entities);
				}
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
				if (currentState == State::Falling && newState == State::Grounded)
				{
					newState = State::Empty;
				}
				if ((currentState == State::Falling && newState == State::Empty)
					|| (currentState == State::Empty && newState == State::Falling))
				{
					grid.setCell(row, column, newState, entities);
				}
			}
		}
		currentOffset.x += 1;
	}
	void setCellAux(Vector2Int coord, int64_t newState)
	{
		if (newState < 0)
		{
			return;
		}
		if (!grid.isValidCoordinate(coord))
		{
			return;
		}
		uint32_t state = grid.getCell(coord.y, coord.x, entities);
		if (state == State::Grounded || newState == State::Grounded)
		{
			return;
		}
		grid.setCell(coord.y, coord.x, newState, entities);
	}
	void rotate()
	{
		Vector2Int co = currentOffset;
		for(int32_t x = 0; x < 2; ++x)
		{
			for (int32_t y = x; y < 4-x-1; ++y)
			{
				Vector2Int coord1(co.x + x, co.y + y);
				Vector2Int coord2(co.x + y, co.y + 4 - 1 - x);
				Vector2Int coord3(co.x + 4 - 1 - x, co.y + 4 - 1 - y);
				Vector2Int coord4(co.x + 4 - 1 - y, co.y + x);

				int64_t state1 = grid.isValidCoordinate(coord1) ?  grid.getCell(coord1.y, coord1.x, entities) : -1;
				int64_t state2 = grid.isValidCoordinate(coord2) ?  grid.getCell(coord2.y, coord2.x, entities) : -1;
				int64_t state3 = grid.isValidCoordinate(coord3) ?  grid.getCell(coord3.y, coord3.x, entities) : -1;
				int64_t state4 = grid.isValidCoordinate(coord4) ?  grid.getCell(coord4.y, coord4.x, entities) : -1;

				setCellAux(coord1, state2);
				setCellAux(coord2, state3);
				setCellAux(coord3, state4);
				setCellAux(coord4, state1);
			}
		}
	}
	bool canSwap(const Vector2Int a, Vector2Int b)
	{
		bool aInBounds = grid.isValidCoordinate(a);
		bool bInBounds = grid.isValidCoordinate(b);
		if (aInBounds && !bInBounds)
		{
			uint32_t stateA = grid.getCell(a.y, a.x, entities);
			return stateA != State::Falling;
		}
		if (bInBounds && !aInBounds)
		{
			uint32_t stateB = grid.getCell(b.y, b.x, entities);
			return stateB != State::Falling;
		}
		uint32_t stateA = grid.getCell(a.y, a.x, entities);
		uint32_t stateB = grid.getCell(b.y, b.x, entities);
		return !((stateA == State::Falling && stateB == State::Grounded)
				|| (stateB == State::Falling && stateA == State::Grounded));
	}
	bool canRotate()
	{
		Vector2Int co = currentOffset;
		for(int32_t x = 0; x < 2; ++x)
		{
			for (int32_t y = x; y < 4-x-1; ++y)
			{
				Vector2Int coord1(co.x + x, co.y + y);
				Vector2Int coord2(co.x + y, co.y + 4 - 1 - x);
				Vector2Int coord3(co.x + 4 - 1 - x, co.y + 4 - 1);
				Vector2Int coord4(co.x + 4 - 1 - y, co.y + x);

				bool isFree = canSwap(coord1, coord2)
					&& canSwap(coord2, coord3)
					&& canSwap(coord3, coord4)
					&& canSwap(coord4, coord1);
				if (!isFree)
				{
					return false;
				}
			}
		}
		return true;
	}
	void loop(double currentTime, const std::vector<bool>& keyStates) override
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
				bool couldMoveLeft = canMoveLeft();
				bool couldMoveRight = canMoveRight();
				moveDown();
				if (keyStates[SDLK_LEFT] && canMoveLeft() && !couldMoveLeft)
				{
					moveLeft();
				}
				if (keyStates[SDLK_RIGHT] && canMoveRight() && !couldMoveRight)
				{
					moveRight();
				}
			}
			lastDrop = currentTime;
		}
	}

	void onMouseButton1Down(const Vector2 position) override
	{
		pauseButton.onMouseButton1Down(position, entities);
	}

	void onMouseButton1Up(const Vector2 position) override
	{
		pauseButton.onMouseButton1Up(position, entities);
	}

	void onKeyDown(SDL_Keycode key) override
	{
		switch (key)
		{
			case SDLK_DOWN:
			case SDLK_SPACE:
			{
				while (canMoveDown())
				{
					moveDown();
				}
				break;
			}
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

	void onLayout(const Vector2& parentPosition,
				  const Vector2& parentSize) override
	{
		pauseButton.onLayout(parentPosition, parentSize, entities);
		grid.onLayout(parentPosition, parentSize, entities);
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
	PlayTetris* playTetris = new PlayTetris(screenSize, 0xffffffff);
	game.setScreen(playTetris);
	playTetris->onLayout(Vector2(), screenSize);

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

