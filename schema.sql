CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    salt VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    profile_image_url VARCHAR(500) DEFAULT '/images/default.jpg',
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_role_check
        CHECK (role IN ('USER', 'ADMIN'))
);


CREATE TABLE blogs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    cover_image_url VARCHAR(500),
    created_by INTEGER NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT blogs_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    blog_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT comments_blog_id_fkey
        FOREIGN KEY (blog_id)
        REFERENCES blogs(id)
        ON DELETE CASCADE,

    CONSTRAINT comments_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE CASCADE
);