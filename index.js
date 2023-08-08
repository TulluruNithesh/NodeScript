/*const addDays = require('date-fns/addDays')
const result = addDays(new Date(2021,1,20),3)
console.log(result)*/
/*const express = require('express');
const app = express()
app.get('/',(request,response) => {
    response.send("hello world");

} );

app.get('/date' ,(request,response) => {
    let date = new Date();
    response.send(`todays date ${date}`);
} );

app.get("/page",(request,response) => {
    response.sendFile("./page.html",{root: __dirname})
})
app.listen(3000);*/

const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const app = express();
app.use(express.json())

const dbPath = path.join(__dirname, "goodreads.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.get('/book/', async(request,response) => {
    const getBooksQuery = `
    SELECT
      *
    FROM
      book
    ORDER BY
      book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);

})
//get book
app.get('/book/:bookId/', async(request,response) => {
    const {bookId} = request.params 
    const getBooksQuery = `
    SELECT
      *
    FROM
      book
    ORDER BY
      book_id = ${bookId}; `;
  const bookArray = await db.get(getBooksQuery);
  response.send(bookArray);

})
//post method
app.post("/books/", async (request, response) => {
    const bookDetails = request.body;
    const {
      bookId,
      name,
      rating,
      
    } = bookDetails;
    const addBookQuery = `
      INSERT INTO
        book (book_id,name,rating)
      VALUES
        (
           ${bookId},
          '${name}',
           ${rating},
          
        );`;
  
    const dbResponse = await db.run(addBookQuery);
    const bookID = dbResponse.lastID;
    response.send({ bookID: bookID });
  });
//update method
app.put("/books/:bookId/", async (request, response) => {
    const { book_id } = request.params;
    const bookDetails = request.body;
    const {
      bookId,
      name,
      rating,
    } = bookDetails;
    const updateBookQuery = `
      UPDATE
        book
      SET
        name='${name}',
        book_id=${bookId},
        rating=${rating},
        '
      WHERE
        book_id = ${bookId};`;
    await db.run(updateBookQuery);
    response.send("Book Updated Successfully");
  });
//delete
app.delete("/books/:bookId/", async (request, response) => {
    const { bookId } = request.params;
    const deleteBookQuery = `
      DELETE FROM
        book
      WHERE
        book_id = ${bookId};`;
    await db.run(deleteBookQuery);
    response.send("Book Deleted Successfully");
  });

  //get authour books
  app.get("/authors/:authorId/books/", async (request, response) => {
    const { authorId } = request.params;
    const getAuthorBooksQuery = `
      SELECT
       *
      FROM
       book
      WHERE
        author_id = ${authorId};`;
    const booksArray = await db.all(getAuthorBooksQuery);})
    //query parameters
    app.get("/books/", async (request, response) => {
        const {
          offset = 1,
          limit =  3,
          order = "DESC",
          order_by = "rating",
          search_q = "",
        } = request.query;
        const getBooksQuery = `
          SELECT
            *
          FROM
           book
          WHERE
           name LIKE '%${search_q}%'
          ORDER BY ${order_by} ${order}
          LIMIT ${limit} OFFSET ${offset};`;
        const booksArray = await db.all(getBooksQuery);
        response.send(booksArray);
      });

      //Authenticate register
      app.post("/users/",async(request,resolve) => {
        const { username, name, password, gender, location } = request.body;
        const hashedPassword=await bcrypt.hash(request.body.password, 10);
        const selectUserQuery = `select * from user WHERE username = '${username}'`;
        const dbUser = await db.get(selectUserQuery);
        if (dbUser === undefined) {
            const createUserQuery = `
              INSERT INTO 
                user (username, name, password, gender, location) 
              VALUES 
                (
                  '${username}', 
                  '${name}',
                  '${hashedPassword}', 
                  '${gender}',
                  '${location}'
                )`;
            const dbResponse = await db.run(createUserQuery);
            const newUserId = dbResponse.lastID;
            response.send(`Created new user with ${newUserId}`);
          } else {
            response.status = 400;
            response.send("User already exists");
          }
      })
//authenticate login
app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        response.send("Login Success!");
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });

//jsonwebtoken login
app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });
//jwttoken books
app.get("/books/", (request, response) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid Access Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.send("Invalid Access Token");
        } else {
          const getBooksQuery = `
              SELECT
                *
              FROM
               book
              ORDER BY
                book_id;`;
          const booksArray = await db.all(getBooksQuery);
          response.send(booksArray);
        }
      });
    }
  });
//middleware common
const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    }
  };
  //get books using authenticate
  app.get("/books/", authenticateToken, async (request, response) => {
    const getBooksQuery = `
     SELECT
      *
     FROM
      book
     ORDER BY
      book_id;`;
    const booksArray = await db.all(getBooksQuery);
    response.send(booksArray);
  });
   
  //payload-passing data by using request
  const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  };

//profile find
app.get("/profile/", authenticateToken, async (request, response) => {
    let { username } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const userDetails = await db.get(selectUserQuery);
    response.send(userDetails);
  });
