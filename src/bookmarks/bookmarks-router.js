const express = require("express");
const { isWebUri } = require("valid-url");
const xss = require("xss");
const logger = require("../logger");
const bmService = require("./bookmarks-service");

const bookmarksRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = bookmark => ({
    id: bookmark.id,
    title: xss(bookmark.title),
    url: bookmark.url,
    description: xss(bookmark.description),
    rating: Number(bookmark.rating)
});

bookmarksRouter
    .route("/bookmarks")
    .get((req, res, next) => {
        bmService
            .getAllBookmarks(req.app.get("db"))
            .then(bookmarks => {
                res.json(bookmarks.map(serializeBookmark));
            })
            .catch(next);
    })
    .post(bodyParser, (req, res, next) => {
        for (const field of ["title", "url", "rating"]) {
            if (!req.body[field]) {
                logger.error(`${field} is required`);
                return res.status(400).send({
                    error: { message: `'${field}' is required` }
                });
            }
        }

        const { title, url, description, rating } = req.body;

        if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
            logger.error(`Invalid rating '${rating}' supplied`);
            return res.status(400).send({
                error: { message: `'rating' must be a number between 0 and 5` }
            });
        }

        if (!isWebUri(url)) {
            logger.error(`Invalid url '${url}' supplied`);
            return res.status(400).send({
                error: { message: `'url' must be a valid URL` }
            });
        }

        const newBookmark = { title, url, description, rating };

        bmService
            .insertBookmark(req.app.get("db"), newBookmark)
            .then(bookmark => {
                logger.info(`Bookmark with id ${bookmark.id} created.`);
                res.status(201)
                    .location(`/bookmarks/${bookmark.id}`)
                    .json(serializeBookmark(bookmark));
            })
            .catch(next);
    });

bookmarksRouter
    .route("/bookmarks/:bookmark_id")
    .all((req, res, next) => {
        const { bookmark_id } = req.params;
        bmService
            .getById(req.app.get("db"), bookmark_id)
            .then(bookmark => {
                if (!bookmark) {
                    logger.error(`Bookmark with id ${bookmark_id} not found.`);
                    return res.status(404).json({
                        error: { message: `Bookmark Not Found` }
                    });
                }
                res.bookmark = bookmark;
                next();
            })
            .catch(next);
    })
    .get((req, res) => {
        res.json(serializeBookmark(res.bookmark));
    })
    .patch(bodyParser, (req, res, next) => {
        const { title, url, description, rating } = req.body;
        const bmUpdate = { title, url, description, rating };

        if (Object.values(bmUpdate).filter(Boolean).length === 0) {
            return res.status(400).json({
                error: {
                    message: `Request body must contain at least one of 
                            'title', 'url', 'rating' or 'description'`
                }
            });
        }
        bmService
            .updateBookmark(req.app.get("db"), req.params.bookmark_id, bmUpdate)
            .then(x => {
                res.status(204).end();
            })
            .catch(next);
    })

    .delete((req, res, next) => {
        const { bookmark_id } = req.params;
        bmService
            .deleteBookmark(req.app.get("db"), bookmark_id)
            .then(numRowsAffected => {
                logger.info(`Bookmark with id ${bookmark_id} deleted.`);
                res.status(204).end();
            })
            .catch(next);
    });

module.exports = bookmarksRouter;
