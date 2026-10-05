export type Book = {
  id: string
  title: string
  author: string
  category: string
  subcategory: string
  description: string
  price: number | null
  mrp: number | null
  rating: number | null
  reviews: number | null
  stock: number | null
  vendor: string
  publisher: string | null
  isbn: string | null
  pages: number | null
  language: string | null
  format: string | null
  year: number | null
  cover: string | null
  featured?: boolean
  bestseller?: boolean
}

const cover = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`

export const books: Book[] = [
  { id:'immortals', title:'The Immortals of Meluha', author:'Amish Tripathi', category:'Mythology & History', subcategory:'Indian Mythology', description:'A sweeping reimagining of a legend, where a reluctant hero is asked to become the very thing he fears.', price:399, mrp:599, rating:4.8, reviews:2184, stock:18, vendor:'Chapter One Books', publisher:'Westland', isbn:'9789388754006', pages:436, language:'English', format:'Paperback', year:2010, cover:cover('photo-1544947950-fa07a98d237f'), featured:true, bestseller:true },
  { id:'palace-of-illusions', title:'The Palace of Illusions', author:'Chitra Banerjee Divakaruni', category:'Indian Fiction', subcategory:'Mythological Fiction', description:'The Mahabharata retold through the eyes of a woman who refuses to be a footnote in history.', price:499, mrp:699, rating:4.7, reviews:1462, stock:11, vendor:'Paper Lantern', publisher:'Picador India', isbn:'9788184001813', pages:360, language:'English', format:'Paperback', year:2008, cover:cover('photo-1512820790803-83ca734da794'), bestseller:true },
  { id:'midnight-library', title:'The Midnight Library', author:'Matt Haig', category:'International Fiction', subcategory:'Contemporary', description:'Between life and death there is a library, and within that library, the chance to try the lives you could have lived.', price:449, mrp:599, rating:4.6, reviews:3187, stock:23, vendor:'The Reading Room', publisher:'Canongate', isbn:null, pages:304, language:'English', format:'Paperback', year:2020, cover:cover('photo-1543002588-bfa74002ed7e'), bestseller:true },
  { id:'atomic-habits', title:'Atomic Habits', author:'James Clear', category:'Self Help', subcategory:'Personal Development', description:'A practical framework for making small changes that compound into remarkable results.', price:549, mrp:799, rating:4.8, reviews:5320, stock:7, vendor:'Chapter One Books', publisher:'Avery', isbn:'9781847941831', pages:null, language:'English', format:'Hardcover', year:2018, cover:cover('photo-1495446815901-a7297e633e8d'), bestseller:true },
  { id:'murder-orient', title:'Murder on the Orient Express', author:'Agatha Christie', category:'Mystery & Thriller', subcategory:'Classic Mystery', description:'A luxury train, a snowbound night, and one of Hercule Poirot’s most intricate cases.', price:299, mrp:399, rating:4.7, reviews:1987, stock:30, vendor:'The Reading Room', publisher:'HarperCollins', isbn:null, pages:288, language:'English', format:'Paperback', year:null, cover:cover('photo-1509695507497-903c140c43b0'), bestseller:true },
  { id:'hobbit', title:'The Hobbit', author:'J.R.R. Tolkien', category:'Fantasy', subcategory:'Classic Fantasy', description:'A quiet life takes a sharp turn when a hobbit joins a company of dwarves on an unforgettable quest.', price:399, mrp:599, rating:4.9, reviews:4056, stock:14, vendor:'Paper Lantern', publisher:'HarperCollins', isbn:'9780261102217', pages:310, language:'English', format:'Paperback', year:1937, cover:cover('photo-1516979187457-637abb4f9353'), bestseller:true },
  { id:'pride-prejudice', title:'Pride and Prejudice', author:'Jane Austen', category:'Classics', subcategory:'Romance', description:'A sharp, funny, and enduring dance between first impressions and second chances.', price:249, mrp:349, rating:4.8, reviews:2891, stock:26, vendor:'Chapter One Books', publisher:'Penguin Classics', isbn:'9780141439518', pages:432, language:'English', format:'Paperback', year:1813, cover:cover('photo-1521587760476-6c12a4b040da') },
  { id:'psychology-money', title:'The Psychology of Money', author:'Morgan Housel', category:'Business & Finance', subcategory:'Money & Investing', description:'Timeless lessons on wealth, greed, and happiness told through short, memorable stories.', price:429, mrp:599, rating:4.6, reviews:1740, stock:9, vendor:'Paper Lantern', publisher:'Harriman House', isbn:'9780857197689', pages:256, language:'English', format:'Paperback', year:2020, cover:cover('photo-1455885666463-5e7f6e8c3b2a') },
  { id:'secret-garden', title:'The Secret Garden', author:'Frances Hodgson Burnett', category:"Children's Books", subcategory:'Children’s Classics', description:'A hidden garden, a lonely child, and the quiet magic of finding your way back to life.', price:279, mrp:399, rating:4.5, reviews:842, stock:20, vendor:'Little Chapters', publisher:'Usborne', isbn:null, pages:288, language:'English', format:'Hardcover', year:1911, cover:cover('photo-1457369804613-52c61a468e7d') },
  { id:'song-achilles', title:'The Song of Achilles', author:'Madeline Miller', category:'International Fiction', subcategory:'Historical Fiction', description:'A luminous retelling of Achilles and Patroclus, told with tenderness, courage, and ache.', price:479, mrp:699, rating:4.7, reviews:2276, stock:5, vendor:'The Reading Room', publisher:'Bloomsbury', isbn:null, pages:378, language:'English', format:'Paperback', year:2011, cover:cover('photo-1474932430478-367dbb6832c1') },
  { id:'sherlock', title:'The Adventures of Sherlock Holmes', author:'Arthur Conan Doyle', category:'Mystery & Thriller', subcategory:'Detective Fiction', description:'Twelve cases that reveal the wit, method, and humanity behind the world’s most famous detective.', price:329, mrp:449, rating:4.7, reviews:1160, stock:null, vendor:'Chapter One Books', publisher:'Wordsworth Editions', isbn:null, pages:null, language:'English', format:'Paperback', year:1892, cover:cover('photo-1541963463532-d68292c34b19') },
  { id:'forest-lullaby', title:'A Lullaby for the Forest', author:'Naina Verma', category:'Indian Literature', subcategory:'Contemporary Poetry', description:'A quiet collection of poems about the landscapes we carry, leave, and return to.', price:null, mrp:null, rating:null, reviews:null, stock:null, vendor:'Little Chapters', publisher:null, isbn:null, pages:null, language:'English', format:'Paperback', year:null, cover:null }
]

export const categories = [
  'Business & Finance', "Children's Books", 'Classics', 'Fantasy', 'Indian Fiction', 'Indian Literature', 'International Fiction', 'Mystery & Thriller', 'Mythology & Historical Fiction', 'Mythology & History', 'Self Help', 'Young Adult'
]

export const formatPrice = (value: number | null) => value === null ? 'Information unavailable' : `₹${value.toLocaleString('en-IN')}`

export type PricePoint = { date: string; price: number }
export type SellerProfile = {
  name: string
  booksSold: number
  authenticityPct: number
  onTimeDeliveryPct: number
  returnRatePct: number
  disputeRatePct: number
  activeSince: string
  verified: boolean
  city: string
  returnWindowDays: number
  deliveryDays: number
}
export type SellerOffer = { vendor: string; price: number; deliveryDays: number; condition: string; verified: boolean }

export const priceHistory: Record<string, PricePoint[]> = {
  immortals: [{ date: 'May', price: 429 }, { date: 'Jun', price: 419 }, { date: 'Jul', price: 409 }, { date: 'Aug', price: 399 }, { date: 'Sep', price: 399 }],
  'palace-of-illusions': [{ date: 'May', price: 529 }, { date: 'Jun', price: 519 }, { date: 'Jul', price: 509 }, { date: 'Aug', price: 499 }, { date: 'Sep', price: 499 }],
  'midnight-library': [{ date: 'May', price: 479 }, { date: 'Jun', price: 469 }, { date: 'Jul', price: 459 }, { date: 'Aug', price: 449 }, { date: 'Sep', price: 449 }],
  'atomic-habits': [{ date: 'May', price: 599 }, { date: 'Jun', price: 579 }, { date: 'Jul', price: 569 }, { date: 'Aug', price: 549 }, { date: 'Sep', price: 549 }],
  'murder-orient': [{ date: 'May', price: 329 }, { date: 'Jun', price: 319 }, { date: 'Jul', price: 309 }, { date: 'Aug', price: 299 }, { date: 'Sep', price: 299 }],
  hobbit: [{ date: 'May', price: 429 }, { date: 'Jun', price: 419 }, { date: 'Jul', price: 409 }, { date: 'Aug', price: 399 }, { date: 'Sep', price: 399 }],
  'pride-prejudice': [{ date: 'May', price: 279 }, { date: 'Jun', price: 269 }, { date: 'Jul', price: 259 }, { date: 'Aug', price: 249 }, { date: 'Sep', price: 249 }],
  'psychology-money': [{ date: 'May', price: 459 }, { date: 'Jun', price: 449 }, { date: 'Jul', price: 439 }, { date: 'Aug', price: 429 }, { date: 'Sep', price: 429 }],
  'secret-garden': [{ date: 'May', price: 299 }, { date: 'Jun', price: 294 }, { date: 'Jul', price: 289 }, { date: 'Aug', price: 279 }, { date: 'Sep', price: 279 }],
  'song-achilles': [{ date: 'May', price: 499 }, { date: 'Jun', price: 494 }, { date: 'Jul', price: 489 }, { date: 'Aug', price: 479 }, { date: 'Sep', price: 479 }],
  sherlock: [{ date: 'May', price: 349 }, { date: 'Jun', price: 344 }, { date: 'Jul', price: 339 }, { date: 'Aug', price: 329 }, { date: 'Sep', price: 329 }]
}

export const sellerProfiles: SellerProfile[] = [
  { name: 'Chapter One Books', booksSold: 4820, authenticityPct: 99.7, onTimeDeliveryPct: 96, returnRatePct: 2.1, disputeRatePct: 0.4, activeSince: 'March 2019', verified: true, city: 'Pune', returnWindowDays: 14, deliveryDays: 3 },
  { name: 'Paper Lantern', booksSold: 3260, authenticityPct: 99.4, onTimeDeliveryPct: 94, returnRatePct: 2.8, disputeRatePct: 0.6, activeSince: 'July 2020', verified: true, city: 'Mumbai', returnWindowDays: 14, deliveryDays: 4 },
  { name: 'The Reading Room', booksSold: 2910, authenticityPct: 98.9, onTimeDeliveryPct: 97, returnRatePct: 1.9, disputeRatePct: 0.5, activeSince: 'January 2021', verified: true, city: 'Bengaluru', returnWindowDays: 7, deliveryDays: 2 },
  { name: 'Little Chapters', booksSold: 1740, authenticityPct: 99.2, onTimeDeliveryPct: 91, returnRatePct: 3.4, disputeRatePct: 0.8, activeSince: 'September 2022', verified: true, city: 'Pune', returnWindowDays: 14, deliveryDays: 5 }
]

export const sellerOffers: Record<string, SellerOffer[]> = {
  immortals: [
    { vendor: 'Paper Lantern', price: 419, deliveryDays: 4, condition: 'New · publisher sourced', verified: true },
    { vendor: 'The Reading Room', price: 429, deliveryDays: 2, condition: 'New · publisher sourced', verified: true }
  ],
  hobbit: [
    { vendor: 'Chapter One Books', price: 419, deliveryDays: 3, condition: 'New · publisher sourced', verified: true },
    { vendor: 'The Reading Room', price: 409, deliveryDays: 2, condition: 'New · publisher sourced', verified: true }
  ],
  'midnight-library': [
    { vendor: 'Chapter One Books', price: 459, deliveryDays: 3, condition: 'New · publisher sourced', verified: true }
  ]
}
