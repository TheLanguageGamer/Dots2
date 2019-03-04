#include "Engine.h"
	
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

