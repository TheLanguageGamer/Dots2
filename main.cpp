
#include <vector>
#include <unordered_map>
#include <functional>
#include <random>
#include <stdio.h>
#include <SDL/SDL_gfxPrimitives.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
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

struct BoxInt
{
	Vector2Int position;
	Vector2Int size;
	BoxInt(const Vector2Int& position, const Vector2Int& size)
	: position(position)
	, size(size) {}
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
	uint32_t rgba;
	uint32_t id;
	Type type;
	Entity(Type type, Vector2 position, Vector2 size, uint32_t rgba)
	: type(type)
	, position(position)
	, size(size)
	, rgba(rgba) {}
	Entity(Type type, Vector2 position, Vector2 size, uint32_t rgba, uint32_t id)
	: type(type)
	, position(position)
	, size(size)
	, rgba(rgba)
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
	enum GameState
	{
		Running,
		Paused,
		Dead,
	};

	std::vector<Entity>& entities;
	Vector2 screenSize;
	uint32_t bgColor;
	Screen(Vector2 screenSize, uint32_t bgColor, std::vector<Entity>& entities)
	: screenSize(screenSize)
	, bgColor(bgColor)
	, entities(entities) {}
	//Screen() {}
	virtual bool loop(double currentTime, const std::vector<bool>& keyStates) { return false; }
	virtual void onKeyUp(SDL_Keycode key) {}
	virtual void onKeyDown(SDL_Keycode key) {}
	virtual void onMouseButton1Down(const Vector2 position) {}
	virtual void onMouseButton1Up(const Vector2 position) {}
	virtual void onFocusLost() {}
	virtual void onLayout(const Vector2& parentPosition, const Vector2& parentSize) {}
	virtual void reset() {}
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
						entity.rgba);
					break;
				}
				case Type::Rectangle:
				{
					boxColor(surface,
						entity.position.x,
						entity.position.y,
						entity.position.x + entity.size.x,
						entity.position.y + entity.size.y,
						entity.rgba);
					break;
				}
				case Type::Text:
				{
					const std::string& text = getTextForId(entity.id);
					filledTextColor(surface,
						text.c_str(),
						entity.position.x,
						entity.position.y,
						entity.rgba);
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

	void onFocusLost()
	{
		screen->onFocusLost();
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

		float newX = parentPosition.x + (parentSize.x)*relativePosition.x - anchorPoint.x*newScreenSize.x + offsetPosition.x;
		float newY = parentPosition.y + (parentSize.y)*relativePosition.y - anchorPoint.y*newScreenSize.y + offsetPosition.y;

		Vector2 newScreenPosition = Vector2(newX, newY);

		printf("\n\nComponent.onLayout parentPosition: %4.2f x %4.2f\n", parentPosition.x, parentPosition.y);
		printf("Component.onLayout screenPosition: %4.2f x %4.2f\n", screenPosition.x, screenPosition.y);
		printf("Component.onLayout newScreenPosition: %4.2f x %4.2f\n", newScreenPosition.x, newScreenPosition.y);
		printf("Component.onLayout screenSize: %4.2f x %4.2f\n", screenSize.x, screenSize.y);
		printf("Component.onLayout newScreenSize: %4.2f x %4.2f\n", newScreenSize.x, newScreenSize.y);
		
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

			if (entities[index].type != Type::Text)
			{
				float newWidth = (entitySize.x/screenSize.x)*newScreenSize.x;
				float newHeight = (entitySize.y/screenSize.y)*newScreenSize.y;

				entities[index].size = Vector2(newWidth, newHeight);
			}
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

	bool onMouseButton1Up(const Vector2& mousePosition, std::vector<Entity>& entities)
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
				return true;
			}
		}
		return false;
	}
};

struct TextList : Component
{
	TextList(const Vector2& relativePosition,
			 const Vector2& offsetPosition,
			 const Vector2& anchorPoint,
			 float fontSize,
			 std::vector<std::string> texts,
			 std::vector<Entity>& entities)
	: Component(relativePosition, offsetPosition, Vector2(), Vector2(), anchorPoint)
	{
		int32_t startIndex = entities.size();
		float rowHeight = fontSize*1.2;
		float width = 0.0;
		for (int32_t i = 0; i < texts.size(); ++i)
		{
			float entityWidth = texts[i].size()*fontSize*0.6;
			width = entityWidth > width ? entityWidth : width;
			entities.push_back(createText(texts[i], 0.0, rowHeight*(i+1), fontSize, 0x000000ff));
		}
		screenSize = Vector2(width, texts.size()*rowHeight);
		offsetSize = screenSize;
		int32_t endIndex = entities.size();
		indexSpan = Vector2Int(startIndex, endIndex);
	}

	TextList() {}

	void setTextForIndex(int64_t value, uint32_t relativeIndex, std::vector<Entity>& entities)
	{
		uint32_t index = indexSpan.x + relativeIndex;
		char buffer[256];
		sprintf(buffer, "%lld", value);
		uint32_t id = getIdForText(buffer);
		entities[index].id = id;
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
			for(int32_t j = 0; j < matrixSize.y; ++j)
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

	BoxInt getBoundingSquare(uint32_t state, std::vector<Entity>& entities)
	{
		int32_t minX = matrixSize.x;
		int32_t maxX = -1;
		int32_t minY = matrixSize.y;
		int32_t maxY = -1;

		for (int32_t i = 0; i < matrixSize.x; ++i)
		{
			for(int32_t j = 0; j < matrixSize.y; ++j)
			{
				if (getCell(j, i, entities) == state)
				{
					minX = i < minX ? i : minX;
					maxX = i > maxX ? i : maxX;
					minY = j < minY ? j : minY;
					maxY = j > maxY ? j : maxY;
				}
			}
		}

		int32_t width = maxX - minX;
		int32_t height = maxY - minY;
		if (width < height)
		{
			int32_t delta = height - width;
			int32_t offByOne = delta % 2;
			bool onRightSide = minX + width/2 > matrixSize.x/2;
			minX -= delta/2 + (onRightSide ? offByOne : 0);
			maxX += delta/2 + (onRightSide ? 0 : offByOne);
			width = maxX - minX;
			if (maxX >= matrixSize.x)
			{
				int32_t temp = maxX - matrixSize.x + 1;
				maxX -= temp;
				minX -= temp;
			}
			if (minX < 0)
			{
				int32_t temp = -minX;
				maxX += temp;
				minX += temp;
			}
		}
		else if (height < width)
		{
			maxY += (width - height);
			height = maxY - minY;
			if (maxY >= matrixSize.y)
			{
				int32_t temp = maxY - matrixSize.y + 1;
				maxY -= temp;
				minY -= temp;
			}
		}
		return BoxInt(Vector2Int(minX, minY), Vector2Int(width+1, height+1));
	}

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
		if (row < 0 || column < 0 || row >= matrixSize.y || column >= matrixSize.x)
		{
			printf("invalid coordinate! %u x %u\n", row, column);
		}
		return (entities[getCellIndex(row, column)].rgba) >> 8;
	}

	uint32_t getCellVisibility(uint32_t row, uint32_t column, std::vector<Entity>& entities)
	{
		uint32_t color = entities[getCellBackgroundIndex(row, column)].rgba;
		return color & 0xff;
	}

	uint32_t getForegroundVisibility(uint32_t row, uint32_t column, std::vector<Entity>& entities)
	{
		uint32_t color = entities[getCellIndex(row, column)].rgba;
		return color & 0xff;
	}

	void setCellVisibility(uint32_t row, uint32_t column, uint32_t visibility, std::vector<Entity>& entities)
	{
		uint32_t bgColor = entities[getCellBackgroundIndex(row, column)].rgba;
		uint32_t cellColor = entities[getCellIndex(row, column)].rgba;
		uint32_t newBgColor = (bgColor & 0xffffff00) | visibility;
		uint32_t newCellColor = (cellColor & 0xffffff00) | visibility;
		entities[getCellBackgroundIndex(row, column)].rgba = newBgColor;
		entities[getCellIndex(row, column)].rgba = newCellColor;
	}

	void setForegroundVisibility(uint32_t row, uint32_t column, uint32_t visibility, std::vector<Entity>& entities)
	{
		uint32_t cellColor = entities[getCellIndex(row, column)].rgba;
		uint32_t newCellColor = (cellColor & 0xffffff00) | visibility;
		entities[getCellIndex(row, column)].rgba = newCellColor;
	}

	void setCell(uint32_t row, uint32_t column, uint32_t state, std::vector<Entity>& entities)
	{
		uint32_t color = entities[getCellIndex(row, column)].rgba;
		uint32_t visibility = color & 0xff;
		uint32_t newVisibility = state > 0 ? getCellVisibility(row, column, entities) : 0x0;
		uint32_t newColor = (state << 8) | newVisibility;
		entities[getCellIndex(row, column)].rgba = newColor;
		//printf("Cell set to: %u\n", newColor);
	}

	void setCellBackground(uint32_t row, uint32_t column, uint32_t newColor, std::vector<Entity>& entities)
	{
		uint32_t rgba = entities[getCellBackgroundIndex(row, column)].rgba;
		uint32_t visibility = rgba & 0xff;
		uint32_t newVisibility = getCellVisibility(row, column, entities);
		uint32_t newRgba = (newColor << 8) | newVisibility;
		entities[getCellBackgroundIndex(row, column)].rgba = newRgba;
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

	bool isValidCoordinate(const Vector2Int& a)
	{
		return a.x >= 0 && a.y >= 0 && a.x < matrixSize.x && a.y < matrixSize.y;
	}
};

	
enum TS
{
	TS_Empty = 0x0,
	TS_Falling = 0xff9900,
	TS_Grounded = 0x00cc66
};

struct TetrisConfiguration
{
	enum Mode
	{
		Regular = 0,
		RotatingGround,
		Invisible,
	};
	std::vector<std::vector<std::vector<uint32_t>>> shapes;
	Vector2Int boardSize;
	Vector2Int activeColumnSpan;
	Mode mode;
	bool visible;
};

std::vector<std::vector<std::vector<uint32_t>>> getTetrominoes()
{
	return std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
	});
}

std::vector<std::vector<std::vector<uint32_t>>> getPentominoes()
{
	return std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
	});
}

TetrisConfiguration getVanillaTetris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.boardSize = Vector2Int(10, 24);
	configuration.activeColumnSpan = Vector2Int(0, 9);
	configuration.shapes = getTetrominoes();
	configuration.visible = false;
	return configuration;
}

TetrisConfiguration getInvisibleTetris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Invisible;
	configuration.boardSize = Vector2Int(10, 24);
	configuration.activeColumnSpan = Vector2Int(0, 9);
	configuration.shapes = getTetrominoes();
	configuration.visible = false;
	return configuration;
}

TetrisConfiguration getSirTet()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::RotatingGround;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(20, 24);
	configuration.activeColumnSpan = Vector2Int(5, 14);
	configuration.shapes = getTetrominoes();
	return configuration;
}

TetrisConfiguration getTttetris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(15, 24);
	configuration.activeColumnSpan = Vector2Int(0, 9);
	configuration.shapes = std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Falling},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Falling},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling},
			{TS_Falling, TS_Falling, TS_Falling},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
	});
	return configuration;
}

TetrisConfiguration getPentris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(13, 24);
	configuration.activeColumnSpan = Vector2Int(0, 9);
	configuration.shapes = getPentominoes();
	return configuration;
}

TetrisConfiguration getAllminos()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(12, 24);
	configuration.activeColumnSpan = Vector2Int(0, 11);

	configuration.shapes = std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Falling, TS_Empty},
			{TS_Falling, TS_Falling},
		},
		{
			{TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty},
		},
	});

	auto tetrominoes = getTetrominoes();
	auto pentominoes = getPentominoes();

	configuration.shapes.insert(configuration.shapes.end(), tetrominoes.begin(), tetrominoes.end());
	configuration.shapes.insert(configuration.shapes.end(), pentominoes.begin(), pentominoes.end());

	return configuration;
}

struct PlayTetris : Screen
{
	double period;
	double lastDrop;
	Grid grid;

	TextList textList;

	uint32_t level;
	uint32_t lines;
	uint32_t score;

	TetrisConfiguration configuration;
	std::vector<std::vector<uint32_t>> currentShape;
	Vector2Int currentOffset;
	Vector2Int activeColumnSpan;
	std::uniform_int_distribution<uint32_t> shapePrDist;
	std::uniform_int_distribution<uint32_t> rotationPrDist;

	PlayTetris(Vector2 screenSize,
		uint32_t bgColor,
		std::vector<Entity>& entities,
		TetrisConfiguration configuration)
	: Screen(screenSize, bgColor, entities)
	, configuration(configuration)
	, activeColumnSpan(configuration.activeColumnSpan)
	, period(200.0)
	, lastDrop(0.0)
	, shapePrDist(0, 0)
	, currentOffset(0, 0)
	, level(1)
	, lines(0)
	, score(0)
	{
		grid = Grid(Vector2(0.5, 0.5),
					Vector2(0.0, 0.0),
					Vector2(0.5, 0.8),
					Vector2(0.0, 0.0),
					Vector2(0.5, 0.5 + 1.0/12.0),
					Vector2Int(configuration.boardSize.x, configuration.boardSize.y),
					Vector2(15, 15),
					2.0f,
					entities);

		textList = TextList(Vector2(1.0, 1/6.0),
							Vector2(20.0, 0.0),
							Vector2(0.0, 0.0),
							30.0,
							{ "LEVEL", "1", "LINES", "0", "SCORE", "0" },
							entities);

		shapePrDist = std::uniform_int_distribution<uint32_t>(0, configuration.shapes.size()-1);
		rotationPrDist = std::uniform_int_distribution<uint32_t>(0, 3);

		// for (int32_t row = 0; row < 3; ++row)
		// {
		// 	for (int32_t column = 0; column < grid.matrixSize.x; ++column)
		// 	{
		// 		grid.setCellVisibility(row, column, 0x0, entities);
		// 	}
		// }

		setBackground();
		stampRandomShape();
		updatePrograss(0);

		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{			
			while (canMoveDown())
			{
				moveDown();
			}
			ground();
			stampRandomShape();
		}
	}
	void reset() override
	{
		lines = 0;
		score = 0;
		updatePrograss(0);
		for (int32_t row = 0; row < grid.matrixSize.y; ++row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				grid.setCell(row, column, TS_Empty, entities);
			}
		}
		stampRandomShape();

		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{			
			while (canMoveDown())
			{
				moveDown();
			}
			ground();
			stampRandomShape();
		}
	}
	void setBackground()
	{
		for (int32_t row = 0; row < grid.matrixSize.y; ++row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t color = (column >= activeColumnSpan.x && column <= activeColumnSpan.y) ? 0xdddddd : 0xaaaaaa;
				grid.setCellBackground(row, column, color, entities);
			}
		}
	}
	void setFallingPieceVisibility(uint32_t v)
	{
		for (int32_t row = 0; row < grid.matrixSize.y; ++row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t state = grid.getCell(row, column, entities);
				uint32_t visibility = state == TS_Falling ? v : grid.getForegroundVisibility(row, column, entities);
				grid.setForegroundVisibility(row, column, visibility, entities);
			}
		}
	}
	void stampRandomShape()
	{
		currentOffset = Vector2Int(grid.matrixSize.x/2-2, 0);
		auto shape = configuration.shapes[shapePrDist(rng)];
		//auto shape = configuration.shapes[6];
		grid.stamp(shape, currentOffset, entities);
		currentShape = shape;

		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{
			uint32_t count = rotationPrDist(rng);
			for (uint32_t i = 0; i < count; ++i)
			{
				uint32_t rotatingState = TS_Falling;
				BoxInt box = grid.getBoundingSquare(rotatingState, entities);
				if (canRotate(box.position, box.size.x, rotatingState))
				{
					rotate(box.position, box.size.x, rotatingState);
					clearRows();
				}
			}
		}
	}
	void ground()
	{
		for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = currentState != TS_Empty ? TS_Grounded : TS_Empty;	
				grid.setCell(row, column, newState, entities);
			}
		}
	}
	void updatePrograss(uint32_t rowsCleared)
	{
		lines += rowsCleared;
		level = lines/10 + 1;
		if (rowsCleared == 1)
		{
			score += 100;
		}
		else if (rowsCleared == 2)
		{
			score += 300;
		}
		else if (rowsCleared == 3)
		{
			score += 500;
		}
		else if (rowsCleared == 4)
		{
			score += 800;
		}
		else if (rowsCleared == 5)
		{
			score += 1100;
		}
		else if (rowsCleared == 6)
		{
			score += 1500;
		}

		period = 700.0/(1.0 + 2.0/3.0*((float)level-1.0));

		textList.setTextForIndex(level, 1, entities);
		textList.setTextForIndex(lines, 3, entities);
		textList.setTextForIndex(score, 5, entities);
	}
	bool isDead()
	{
		for (int32_t row = 0; row < 4; ++ row)
		{
			for (int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t state = grid.getCell(row, column, entities);
				if (state == TS_Grounded)
				{
					return true;
				}
			}
		}
		return false;
	}
	void clearRows()
	{
		uint32_t rowsCleared = 0;
		for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
		{
			bool isFilled = true;
			for (int32_t column = activeColumnSpan.x; column <= activeColumnSpan.y; ++column)
			{
				uint32_t state = grid.getCell(row, column, entities);
				isFilled = isFilled && state == TS_Grounded;
			}
			if (isFilled)
			{
				rowsCleared += 1;
				for (int32_t column = activeColumnSpan.x; column <= activeColumnSpan.y; ++column)
				{
					grid.setCell(row, column, TS_Empty, entities);
				}
				moveDown(row, TS_Grounded);
				row += 1;
			}
		}
		updatePrograss(rowsCleared);
	}
	bool canMoveDown()
	{
		for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
		{
			for(int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t aboveState = row > 0 ? grid.getCell(row-1, column, entities) : TS_Empty;
				uint32_t currentState = grid.getCell(row, column, entities);
				if ((aboveState == TS_Falling && currentState == TS_Grounded)
					|| (row == grid.matrixSize.y-1 && currentState == TS_Falling))
				{
					return false;
				}
			}
		}
		return true;
	}
	bool canMoveLeft(uint32_t activeState)
	{
		for(int32_t column = 0; column < grid.matrixSize.x; ++column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column < grid.matrixSize.x-1 ? grid.getCell(row, column+1, entities) : TS_Empty;
				if ((newState == activeState && currentState != activeState && currentState != TS_Empty)
					|| (column == 0 && currentState == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}
	bool canMoveRight(uint32_t activeState)
	{
		for(int32_t column = grid.matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column > 0 ? grid.getCell(row, column-1, entities) : TS_Empty;
				if ((newState == activeState && currentState != activeState && currentState != TS_Empty)
					|| (column == grid.matrixSize.x-1 && currentState == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}
	void moveDown(int32_t fromRow = -1, uint32_t movingState = TS_Falling)
	{
		fromRow = fromRow < 0 ? grid.matrixSize.y-1 : fromRow;
		for (int32_t row = fromRow; row >= 0; --row)
		{
			for(int32_t column = 0; column < grid.matrixSize.x; ++column)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = row > 0 ? grid.getCell(row-1, column, entities) : TS_Empty;
				if (currentState == movingState && newState != movingState)
				{
					newState = TS_Empty;
				}
				if ((currentState == movingState && newState == TS_Empty)
					|| (currentState == TS_Empty && newState == movingState))
				{
					grid.setCell(row, column, newState, entities);
				}
			}
		}
		currentOffset.y += 1;
		if (configuration.mode == TetrisConfiguration::Invisible)
		{
			setFallingPieceVisibility(0);
		}
	}
	void moveLeft(uint32_t activeState)
	{
		for(int32_t column = 0; column < grid.matrixSize.x; ++column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column < grid.matrixSize.x-1 ? grid.getCell(row, column+1, entities) : TS_Empty;
				if (currentState == activeState && newState != activeState && newState != TS_Empty)
				{
					newState = TS_Empty;
				}
				if ((currentState == activeState && newState == TS_Empty)
					|| (currentState == TS_Empty && newState == activeState))
				{
					grid.setCell(row, column, newState, entities);
				}
			}
		}
		currentOffset.x -= 1;
		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{
			activeColumnSpan.x -= 1;
			activeColumnSpan.y -= 1;
			setBackground();
		}
		if (configuration.mode == TetrisConfiguration::Invisible)
		{
			setFallingPieceVisibility(0xff);
		}
	}
	void moveRight(uint32_t activeState)
	{
		for(int32_t column = grid.matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = grid.matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = grid.getCell(row, column, entities);
				uint32_t newState = column > 0 ? grid.getCell(row, column-1, entities) : TS_Empty;
				if (currentState == activeState && newState != activeState && newState != TS_Empty)
				{
					newState = TS_Empty;
				}
				if ((currentState == activeState && newState == TS_Empty)
					|| (currentState == TS_Empty && newState == activeState))
				{
					grid.setCell(row, column, newState, entities);
				}
			}
		}
		currentOffset.x += 1;
		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{
			activeColumnSpan.x += 1;
			activeColumnSpan.y += 1;
			setBackground();
		}
		if (configuration.mode == TetrisConfiguration::Invisible)
		{
			setFallingPieceVisibility(0xff);
		}
	}
	void setCellAux(Vector2Int coord, int64_t newState, uint32_t activeState)
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
		if ((state != activeState && state != TS_Empty) || (newState != activeState && newState != TS_Empty))
		{
			return;
		}
		grid.setCell(coord.y, coord.x, newState, entities);
	}
	void rotate(const Vector2Int& offset, uint32_t shapeWidth, uint32_t activeState)
	{
		// uint32_t shapeWidth = currentShape.size();
		// Vector2Int co = currentOffset;
		for(int32_t x = 0; x < shapeWidth/2; ++x)
		{
			for (int32_t y = x; y < shapeWidth-x-1; ++y)
			{
				Vector2Int coord1(offset.x + x, offset.y + y);
				Vector2Int coord2(offset.x + y, offset.y + shapeWidth - 1 - x);
				Vector2Int coord3(offset.x + shapeWidth - 1 - x, offset.y + shapeWidth - 1 - y);
				Vector2Int coord4(offset.x + shapeWidth - 1 - y, offset.y + x);

				int64_t state1 = grid.isValidCoordinate(coord1) ?  grid.getCell(coord1.y, coord1.x, entities) : TS_Empty;
				int64_t state2 = grid.isValidCoordinate(coord2) ?  grid.getCell(coord2.y, coord2.x, entities) : TS_Empty;
				int64_t state3 = grid.isValidCoordinate(coord3) ?  grid.getCell(coord3.y, coord3.x, entities) : TS_Empty;
				int64_t state4 = grid.isValidCoordinate(coord4) ?  grid.getCell(coord4.y, coord4.x, entities) : TS_Empty;

				setCellAux(coord1, state2, activeState);
				setCellAux(coord2, state3, activeState);
				setCellAux(coord3, state4, activeState);
				setCellAux(coord4, state1, activeState);
			}
		}
		if (configuration.mode == TetrisConfiguration::Invisible)
		{
			setFallingPieceVisibility(0);
		}
	}
	bool canSwap(const Vector2Int a, Vector2Int b, uint32_t activeState)
	{
		bool aInBounds = grid.isValidCoordinate(a);
		bool bInBounds = grid.isValidCoordinate(b);
		if (!aInBounds && !bInBounds)
		{
			return true;
		}
		if (aInBounds && !bInBounds)
		{
			uint32_t stateA = grid.getCell(a.y, a.x, entities);
			return stateA != TS_Falling;
		}
		if (bInBounds && !aInBounds)
		{
			uint32_t stateB = grid.getCell(b.y, b.x, entities);
			return stateB != TS_Falling;
		}
		uint32_t stateA = grid.getCell(a.y, a.x, entities);
		uint32_t stateB = grid.getCell(b.y, b.x, entities);
		return !((stateA == activeState && (stateB != activeState && stateB != TS_Empty))
				|| (stateB == activeState && (stateA != activeState && stateA != TS_Empty)));
	}
	bool canRotate(const Vector2Int& offset, uint32_t shapeWidth, uint32_t activeState)
	{
		// uint32_t shapeWidth = currentShape.size();
		// Vector2Int co = currentOffset;
		if (offset.x < 0
			|| offset.x + shapeWidth > grid.matrixSize.x
			|| offset.y < 0
			|| offset.y + shapeWidth > grid.matrixSize.y)
		{
			printf("Can't rotate: %d %d %d %d\n", offset.x, offset.y, offset.x + shapeWidth, offset.y + shapeWidth);
			return false;
		}
		for(int32_t x = 0; x < shapeWidth; ++x)
		{
			for (int32_t y = x; y < shapeWidth-x-1; ++y)
			{
				Vector2Int coord1(offset.x + x, offset.y + y);
				Vector2Int coord2(offset.x + y, offset.y + shapeWidth - 1 - x);
				Vector2Int coord3(offset.x + shapeWidth - 1 - x, offset.y + shapeWidth - 1);
				Vector2Int coord4(offset.x + shapeWidth - 1 - y, offset.y + x);

				bool isFree = canSwap(coord1, coord2, activeState)
					&& canSwap(coord2, coord3, activeState)
					&& canSwap(coord3, coord4, activeState)
					&& canSwap(coord4, coord1, activeState);
				if (!isFree)
				{
					return false;
				}
			}
		}
		return true;
	}
	bool loop(double currentTime, const std::vector<bool>& keyStates) override
	{
		bool dead = false;
		uint32_t activeState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
		float effectivePeriod = (keyStates[SDLK_DOWN] || keyStates[SDLK_s]) ? period / 10.0 : period;
		if (currentTime - lastDrop > effectivePeriod)
		{
			if (!canMoveDown())
			{
				ground();
				clearRows();
				dead = isDead();
				stampRandomShape();
			}
			else
			{
				bool couldMoveLeft = canMoveLeft(activeState);
				bool couldMoveRight = canMoveRight(activeState);
				moveDown();
				if (keyStates[SDLK_LEFT] && canMoveLeft(activeState) && !couldMoveLeft)
				{
					moveLeft(activeState);
					clearRows();
				}
				if (keyStates[SDLK_RIGHT] && canMoveRight(activeState) && !couldMoveRight)
				{
					moveRight(activeState);
					clearRows();
				}
			}
			lastDrop = currentTime;
		}
		return dead;
	}

	void onKeyDown(SDL_Keycode key) override
	{
		uint32_t activeState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
		switch (key)
		{
			case SDLK_SPACE:
			{
				while (canMoveDown())
				{
					moveDown();
					clearRows();
				}
				break;
			}
			case SDLK_LEFT:
			case SDLK_a:
			{
				if (canMoveLeft(activeState))
				{
					moveLeft(activeState);
					clearRows();
				}
				break;
			}
			case SDLK_RIGHT:
			case SDLK_d:
			{
				if (canMoveRight(activeState))
				{
					moveRight(activeState);
					clearRows();
				}
				break;
			}
			case SDLK_UP:
			case SDLK_w:
			{
				uint32_t rotatingState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
				BoxInt box = grid.getBoundingSquare(rotatingState, entities);

				printf("rotating box: %d x %d - %d x %d\n", box.position.x, box.position.y, box.size.x, box.size.y);
				if (canRotate(box.position, box.size.x, rotatingState))
				{
					rotate(box.position, box.size.x, rotatingState);
					if (configuration.mode == TetrisConfiguration::RotatingGround)
					{
						int32_t activeColumnCenter = activeColumnSpan.x + (activeColumnSpan.y - activeColumnSpan.x + 1)/2;
						int32_t rotatedCenter = box.position.x + box.size.x / 2;
						int32_t delta = rotatedCenter - activeColumnCenter;
						activeColumnSpan.x += delta;
						activeColumnSpan.y += delta;
						setBackground();
					}
					clearRows();
				}
				break;
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
		grid.onLayout(parentPosition, parentSize, entities);
		textList.onLayout(grid.screenPosition, grid.screenSize, entities);
	}
};

struct StateManager : Screen
{
	GameState gameState;

	TextButton pauseButton;
	TextButton resumeButton;
	TextButton againButton;

	uint32_t coverIndex;
	
	Screen* screen;
	StateManager(Vector2 screenSize,
		uint32_t bgColor,
		std::vector<Entity>& entities,
		Screen* screen)
	: Screen(screenSize, bgColor, entities)
	, screen(screen)
	, gameState(Running)
	{
		pauseButton = TextButton("PAUSE",
								 Vector2(1.0,  0.0),
								 Vector2(-10.0, 10.0),
								 Vector2(1.0, 0.0),
								 30,
								 0xaaaaffff,
								 entities);

		coverIndex = entities.size();
		entities.push_back(createRectangle(Vector2(0, -screenSize.y), screenSize, 0xffffff66));

		resumeButton = TextButton("RESUME",
								 Vector2(0.5,  0.5),
								 Vector2(0.0, -screenSize.y),
								 Vector2(0.5, 0.5),
								 30,
								 0xaaaaffff,
								 entities);

		againButton = TextButton("AGAIN",
								 Vector2(0.5,  0.5),
								 Vector2(0.0, -screenSize.y),
								 Vector2(0.5, 0.5),
								 30,
								 0xaaaaffff,
								 entities);
	}

	bool loop(double currentTime, const std::vector<bool>& keyStates) override
	{
		if (gameState == GameState::Running)
		{
			bool dead = screen->loop(currentTime, keyStates);
			if (dead)
			{
				printf("Dead!\n");
				gameState = GameState::Dead;
				entities[coverIndex].position = Vector2();
				againButton.offsetPosition = Vector2();
				againButton.onLayout(Vector2(), screenSize, entities);
			}
		}

		return false;
	}
	void onKeyUp(SDL_Keycode key) override
	{
		if (gameState == GameState::Running)
		{
			screen->onKeyUp(key);
		}
	}
	void onKeyDown(SDL_Keycode key) override
	{
		if (gameState == GameState::Running)
		{
			screen->onKeyDown(key);
		}
	}
	void onMouseButton1Down(const Vector2 position) override
	{
		screen->onMouseButton1Down(position);
		if (gameState == GameState::Running)
		{
			pauseButton.onMouseButton1Down(position, entities);
		}
		else if (gameState == GameState::Paused)
		{
			resumeButton.onMouseButton1Down(position, entities);
		}
		else if (gameState == GameState::Dead)
		{
			againButton.onMouseButton1Down(position, entities);
		}
	}
	void doPause()
	{
		gameState = GameState::Paused;
		entities[coverIndex].position = Vector2();
		resumeButton.offsetPosition = Vector2();
		resumeButton.onLayout(Vector2(), screenSize, entities);
	}
	void onMouseButton1Up(const Vector2 position) override
	{
		screen->onMouseButton1Up(position);
		if (pauseButton.onMouseButton1Up(position, entities))
		{
			printf("Paused!\n");
			doPause();
		}
		else if (resumeButton.onMouseButton1Up(position, entities))
		{
			printf("Resumed!\n");
			gameState = GameState::Running;
			entities[coverIndex].position = Vector2(0, -screenSize.y);
			resumeButton.offsetPosition = Vector2(0, -screenSize.y);
			resumeButton.onLayout(Vector2(), screenSize, entities);
		}
		else if (againButton.onMouseButton1Up(position, entities))
		{
			printf("Again!\n");
			gameState = GameState::Running;
			entities[coverIndex].position = Vector2(0, -screenSize.y);
			againButton.offsetPosition = Vector2(0, -screenSize.y);
			againButton.onLayout(Vector2(), screenSize, entities);
			screen->reset();
		}
	}
	void onFocusLost() override
	{
		doPause();
	}
	void onLayout(const Vector2& parentPosition, const Vector2& parentSize) override
	{
		screenSize = parentSize;
		pauseButton.onLayout(parentPosition, parentSize, entities);
		resumeButton.onLayout(parentPosition, parentSize, entities);
		againButton.onLayout(parentPosition, parentSize, entities);
		screen->onLayout(parentPosition, parentSize);
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
	PlayTetris* playTetris = new PlayTetris(screenSize, 0xffffffff, entities, getSirTet());
	StateManager* stateManager = new StateManager(screenSize, 0xffffffff, entities, playTetris);
	game.setScreen(stateManager);
	stateManager->onLayout(Vector2(), screenSize);

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

