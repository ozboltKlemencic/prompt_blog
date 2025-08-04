import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

import User from '@models/user';
import { connectToDB } from '@utils/database';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async session({ session }) {
      // store the user id from MongoDB to session
      const sessionUser = await User.findOne({ email: session.user.email });
      session.user.id = sessionUser._id.toString();

      return session;
    },
    async signIn({ account, profile, user, credentials }) {
      try {
        await connectToDB();

        // check if user already exists
        const userExists = await User.findOne({ email: profile.email });

        // if not, create a new document and save user in MongoDB
        if (!userExists) {
          // Function to transliterate Slovene characters
          const transliterate = (text) => {
            const map = {
              'č': 'c', 'Č': 'C',
              'š': 's', 'Š': 'S', 
              'ž': 'z', 'Ž': 'Z',
              'ć': 'c', 'Ć': 'C',
              'đ': 'd', 'Đ': 'D',
              'ü': 'u', 'Ü': 'U',
              'ö': 'o', 'Ö': 'O',
              'ä': 'a', 'Ä': 'A',
              'á': 'a', 'Á': 'A',
              'é': 'e', 'É': 'E',
              'í': 'i', 'Í': 'I',
              'ó': 'o', 'Ó': 'O',
              'ú': 'u', 'Ú': 'U'
            };
            return text.replace(/[čšžćđüöäáéíóúČŠŽĆĐÜÖÄÁÉÍÓÚ]/g, char => map[char] || char);
          };

          // Generate a valid username
          let baseUsername = transliterate(profile.name)
            .replace(/[^a-zA-Z0-9]/g, '') // Remove all non-alphanumeric characters
            .toLowerCase();
          
          // Ensure username is at least 8 characters
          if (baseUsername.length < 8) {
            baseUsername = baseUsername + Math.random().toString(36).substring(2, 10);
          }
          
          // Ensure username is not more than 20 characters
          if (baseUsername.length > 20) {
            baseUsername = baseUsername.substring(0, 16) + Math.random().toString(36).substring(2, 6);
          }

          // Check if username already exists and make it unique
          let username = baseUsername;
          let counter = 1;
          while (await User.findOne({ username })) {
            const suffix = counter.toString();
            if (baseUsername.length + suffix.length <= 20) {
              username = baseUsername + suffix;
            } else {
              username = baseUsername.substring(0, 20 - suffix.length) + suffix;
            }
            counter++;
          }

          await User.create({
            email: profile.email,
            username: username,
            image: profile.picture,
          });
        }

        return true
      } catch (error) {
        console.log("Error checking if user exists: ", error.message);
        return false
      }
    },
  }
})

export { handler as GET, handler as POST }
