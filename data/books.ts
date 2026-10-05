export type Book = {
  id: string
  title: string
  author: string
  cover: string
  isbn?: string
  price: number | null
  originalPrice?: number
  rating?: number
  reviews?: number
  stock?: number | null
  sellerCount: number
  vendorId?: string | null
  status: 'in-stock' | 'out-of-stock'
  badge?: string
  category: string
  format: 'paperback' | 'hardcover'
  action?: 'notify' | 'details'
}

const cover = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`
const openLibraryCover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`
const isbnCover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`

const mockSellerCounts: Record<string, number> = {
  'secret-garden': 3, 'song-achilles': 2, sherlock: 2, 'forest-lullaby': 1,
  immortals: 4, 'palace-of-illusions': 3, 'midnight-library': 3, 'atomic-habits': 4,
  'murder-orient': 3, hobbit: 4, 'pride-prejudice': 5, 'psychology-money': 3,
  'great-gatsby': 4, 'little-women': 3, dracula: 2, frankenstein: 2,
  'dorian-gray': 2, alchemist: 5, mockingbird: 4, 'god-small-things': 3,
  'white-tiger': 2, ikigai: 4, 'wuthering-heights': 2, 'jane-eyre': 3,
  'tom-sawyer': 2, 'philosophers-stone': 5, 'book-thief': 3, 'deep-work': 4
}

const bookData: Omit<Book, 'sellerCount'>[] = [
  { id: 'secret-garden', title: 'The Secret Garden', author: 'Frances Hodgson Burnett', cover: isbnCover('9780141182186'), isbn: '9780141182186', price: 299, originalPrice: 399, rating: 4.5, reviews: 842, stock: 20, status: 'in-stock', badge: '25% OFF', category: "Children's Books", format: 'hardcover' },
  { id: 'song-achilles', title: 'The Song of Achilles', author: 'Madeline Miller', cover: isbnCover('9781408821985'), isbn: '9781408821985', price: 479, originalPrice: 699, rating: 4.7, reviews: 2776, stock: 5, status: 'in-stock', badge: '31% OFF', category: 'International Fiction', format: 'paperback' },
  { id: 'sherlock', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', cover: openLibraryCover(6717853), price: 329, originalPrice: 449, rating: 4.7, reviews: 1160, stock: null, status: 'out-of-stock', badge: '27% OFF', category: 'Classics', format: 'paperback', action: 'notify' },
  { id: 'forest-lullaby', title: 'A Lullaby for the Forest', author: 'Naina Verma', cover: cover('photo-1519682337058-a94d519337bc'), price: null, status: 'out-of-stock', category: 'Indian Literature', format: 'paperback', action: 'details' },
  { id: 'immortals', title: 'The Immortals of Meluha', author: 'Amish Tripathi', cover: openLibraryCover(11152324), price: 399, originalPrice: 599, rating: 4.8, reviews: 2184, stock: 18, status: 'in-stock', badge: 'BESTSELLER', category: 'Indian Fiction', format: 'paperback' },
  { id: 'palace-of-illusions', title: 'The Palace of Illusions', author: 'Chitra Banerjee Divakaruni', cover: isbnCover('9780385515993'), isbn: '9780385515993', price: 499, originalPrice: 699, rating: 4.7, reviews: 1462, stock: 11, status: 'in-stock', badge: 'NEW EDITION', category: 'Indian Fiction', format: 'paperback' },
  { id: 'midnight-library', title: 'The Midnight Library', author: 'Matt Haig', cover: isbnCover('9781786892720'), isbn: '9781786892720', price: 449, originalPrice: 599, rating: 4.6, reviews: 3187, stock: 23, status: 'in-stock', category: 'International Fiction', format: 'paperback' },
  { id: 'atomic-habits', title: 'Atomic Habits', author: 'James Clear', cover: isbnCover('9780735211292'), isbn: '9780735211292', price: 549, originalPrice: 799, rating: 4.8, reviews: 5320, stock: 7, status: 'in-stock', badge: 'READER FAVOURITE', category: 'Business & Finance', format: 'hardcover' },
  { id: 'murder-orient', title: 'Murder on the Orient Express', author: 'Agatha Christie', cover: openLibraryCover(11100465), price: 299, originalPrice: 399, rating: 4.7, reviews: 1987, stock: 30, status: 'in-stock', category: 'Mystery & Thriller', format: 'paperback' },
  { id: 'hobbit', title: 'The Hobbit', author: 'J.R.R. Tolkien', cover: isbnCover('9780261103283'), isbn: '9780261103283', price: 399, originalPrice: 599, rating: 4.9, reviews: 4056, stock: 14, status: 'in-stock', badge: 'CLASSIC', category: 'Fantasy', format: 'paperback' },
  { id: 'pride-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', cover: openLibraryCover(14348537), price: 249, originalPrice: 349, rating: 4.8, reviews: 2891, stock: 26, status: 'in-stock', category: 'Classics', format: 'paperback' },
  { id: 'psychology-money', title: 'The Psychology of Money', author: 'Morgan Housel', cover: isbnCover('9780857197689'), isbn: '9780857197689', price: 429, originalPrice: 599, rating: 4.6, reviews: 1740, stock: 9, status: 'in-stock', category: 'Business & Finance', format: 'paperback' },
  { id: 'great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', cover: openLibraryCover(10590366), price: 229, originalPrice: 299, rating: 4.7, reviews: 1824, stock: 17, status: 'in-stock', badge: 'MODERN CLASSIC', category: 'Classics', format: 'paperback' },
  { id: 'little-women', title: 'Little Women', author: 'Louisa May Alcott', cover: openLibraryCover(8775559), price: 279, originalPrice: 349, rating: 4.8, reviews: 1437, stock: 13, status: 'in-stock', category: 'Classics', format: 'hardcover' },
  { id: 'dracula', title: 'Dracula', author: 'Bram Stoker', cover: openLibraryCover(12216503), price: 249, originalPrice: 329, rating: 4.6, reviews: 1120, stock: 16, status: 'in-stock', badge: 'GOTHIC CLASSIC', category: 'Classics', format: 'paperback' },
  { id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', cover: openLibraryCover(12356249), price: 239, originalPrice: 299, rating: 4.6, reviews: 987, stock: 12, status: 'in-stock', category: 'Classics', format: 'paperback' },
  { id: 'dorian-gray', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', cover: openLibraryCover(14314858), price: 259, originalPrice: 329, rating: 4.7, reviews: 876, stock: 10, status: 'in-stock', category: 'Classics', format: 'hardcover' },
  { id: 'alchemist', title: 'The Alchemist', author: 'Paulo Coelho', cover: openLibraryCover(15075893), price: 349, originalPrice: 449, rating: 4.7, reviews: 2481, stock: 22, status: 'in-stock', badge: 'READER FAVOURITE', category: 'International Fiction', format: 'paperback' },
  { id: 'mockingbird', title: 'To Kill a Mockingbird', author: 'Harper Lee', cover: openLibraryCover(14351077), price: 299, originalPrice: 379, rating: 4.8, reviews: 1972, stock: 15, status: 'in-stock', category: 'Classics', format: 'paperback' },
  { id: 'god-small-things', title: 'The God of Small Things', author: 'Arundhati Roy', cover: openLibraryCover(10513792), price: 399, originalPrice: 499, rating: 4.5, reviews: 732, stock: 8, status: 'in-stock', badge: 'BOOKER PRIZE', category: 'Indian Fiction', format: 'paperback' },
  { id: 'white-tiger', title: 'The White Tiger', author: 'Aravind Adiga', cover: openLibraryCover(2787359), price: 329, originalPrice: 399, rating: 4.5, reviews: 694, stock: 11, status: 'in-stock', badge: 'BOOKER PRIZE', category: 'Indian Fiction', format: 'paperback' },
  { id: 'ikigai', title: 'Ikigai', author: 'Héctor García & Francesc Miralles', cover: openLibraryCover(11300391), price: 379, originalPrice: 499, rating: 4.6, reviews: 2156, stock: 19, status: 'in-stock', category: 'Business & Finance', format: 'paperback' },
  { id: 'wuthering-heights', title: 'Wuthering Heights', author: 'Emily Brontë', cover: openLibraryCover(12818862), price: 249, originalPrice: 329, rating: 4.5, reviews: 867, stock: 9, status: 'in-stock', category: 'Classics', format: 'paperback' },
  { id: 'jane-eyre', title: 'Jane Eyre', author: 'Charlotte Brontë', cover: openLibraryCover(8235363), price: 269, originalPrice: 349, rating: 4.8, reviews: 1288, stock: 14, status: 'in-stock', category: 'Classics', format: 'hardcover' },
  { id: 'tom-sawyer', title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', cover: openLibraryCover(12043351), price: 229, originalPrice: 299, rating: 4.5, reviews: 804, stock: 7, status: 'in-stock', category: "Children's Books", format: 'paperback' },
  { id: 'philosophers-stone', title: "Harry Potter and the Philosopher's Stone", author: 'J. K. Rowling', cover: openLibraryCover(15155833), price: 499, originalPrice: 599, rating: 4.9, reviews: 3214, stock: 6, status: 'in-stock', badge: 'FANTASY FAVOURITE', category: 'Fantasy', format: 'hardcover' },
  { id: 'book-thief', title: 'The Book Thief', author: 'Markus Zusak', cover: openLibraryCover(8153054), price: 429, originalPrice: 549, rating: 4.8, reviews: 1678, stock: 10, status: 'in-stock', category: 'International Fiction', format: 'paperback' },
  { id: 'deep-work', title: 'Deep Work', author: 'Cal Newport', cover: openLibraryCover(7988607), price: 449, originalPrice: 599, rating: 4.7, reviews: 1325, stock: 12, status: 'in-stock', category: 'Business & Finance', format: 'paperback' }
]

export const books: Book[] = bookData.map((book) => ({
  ...book,
  sellerCount: mockSellerCounts[book.id] ?? 1
}))

export const categories = [
  { name: 'All', count: books.length },
  { name: 'Business & Finance', count: 342 },
  { name: "Children's Books", count: 128 },
  { name: 'Classics', count: 256 },
  { name: 'Fantasy', count: 410 },
  { name: 'Indian Fiction', count: 312 },
  { name: 'Indian Literature', count: 198 }
]

export const formats = [
  { name: 'paperback', label: 'Paperback', count: 542 },
  { name: 'hardcover', label: 'Hardcover', count: 231 }
] as const
