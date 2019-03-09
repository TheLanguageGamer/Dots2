#pragma once

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

extern "C"
{
	extern void Engine_Test1();
	extern void Engine_Init();
	extern void Engine_FilledEllipse(float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_FilledRectangle(float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_FilledText(const char* text, float x, float y, float fontSize, uint32_t rgba);
}

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
	Text,
	Arc,
	SourceAtop,
};

std::vector<std::string> idToString;
std::unordered_map<std::string, uint32_t> stringToId;

struct Entity
{
	Vector2 position;
	Vector2 size;
	Vector2 span;
	uint32_t rgba;
	uint32_t id;
	Type type;
	Entity(Type type, Vector2 position, Vector2 size, uint32_t rgba)
	: type(type)
	, position(position)
	, size(size)
	, rgba(rgba)
	, id(0)
	, span(Vector2()) {}
	Entity(Type type, Vector2 position, Vector2 size, Vector2 span, uint32_t rgba)
	: type(type)
	, position(position)
	, size(size)
	, rgba(rgba)
	, span(span)
	, id(0) {}
	Entity(Type type, Vector2 position, Vector2 size, uint32_t rgba, uint32_t id)
	: type(type)
	, position(position)
	, size(size)
	, rgba(rgba)
	, id(id)
	, span(Vector2()) {}

	void shift(const Vector2& delta)
	{
		position.x += delta.x;
		position.y += delta.y;
	}
};

static Entity createCircle(float x, float y, float radius, uint32_t rgba)
{
	return Entity(Type::Circle, Vector2(x, y), Vector2(radius*2.0, radius*2.0), rgba);
}

static Entity createArc(const Vector2& position, const Vector2& span, float radius, float width, uint32_t rgba)
{
	Entity ret = Entity(Type::Arc, position, Vector2(radius, width), span, rgba);
	return ret;
}

static Entity createRectangle(const Vector2& position, const Vector2& size, uint32_t rgba)
{
	return Entity(Type::Rectangle, position, size, rgba);
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
				case Type::SourceAtop:
				{
					//setSourceAtop(surface);
					break;
				}
				case Type::Circle:
				{
					Engine_FilledEllipse(
						entity.position.x + entity.size.x/2.0,
						entity.position.y + entity.size.y/2.0,
						entity.size.x/2.0,
						entity.size.y/2.0,
						entity.rgba);
					break;
				}
				case Type::Arc:
				{
					// arcColor(surface,
					// 	entity.position.x, entity.position.y,
					// 	entity.size.x, entity.size.y,
					// 	entity.span.x, entity.span.y,
					// 	entity.rgba);
					break;
				}
				case Type::Rectangle:
				{
					Engine_FilledRectangle(
						entity.position.x,
						entity.position.y,
						entity.size.x,
						entity.size.y,
						entity.rgba);
					break;
				}
				case Type::Text:
				{
					const std::string& text = getTextForId(entity.id);
					Engine_FilledText(
						text.c_str(),
						entity.position.x,
						entity.position.y,
						entity.size.x,
						entity.rgba);
					break;
				}
			}
		}
		// std::string text("WHAT");
		// filledTextColor(surface, text.c_str(), 50, 50, 0x000000ff);
		// SDL_UpdateRect(surface, 0, 0, 0, 0);
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

/*
var canvas = document.getElementById('myCanvas');
var ctx = canvas.getContext('2d');

ctx.strokeStyle = "rgb(50, 50, 50)";
ctx.fillStyle = "rgb(150, 150, 150)";
roundRect(ctx, 18, 18, 50, 50, 15, true);

ctx.strokeStyle = "rgb(50, 50, 50)";
ctx.fillStyle = "rgb(200, 200, 200)";
roundRect(ctx, 22, 22, 50, 50, 15, true);

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof stroke == 'undefined') {
    stroke = true;
  }
  if (typeof radius === 'undefined') {
    radius = 5;
  }
  if (typeof radius === 'number') {
    radius = {tl: radius, tr: radius, br: radius, bl: radius};
  } else {
    var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
    for (var side in defaultRadius) {
      radius[side] = radius[side] || defaultRadius[side];
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }

}*/

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
		if (gameState == GameState::Running)
		{
			doPause();
		}
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