import AuthGuard from "@/app/components/AuthGuard";

export default function AboutPage() {
  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto py-16 px-6 space-y-10">


      <h1 className="text-4xl font-semibold text-center">
        Winnie & Frank
      </h1>

      <img
        src="/frank&winnie.jpeg"
        alt="Frank & Winnie"
        className="w-full rounded-2xl shadow-sm"
      />

      <div className="space-y-6 text-lg leading-relaxed text-gray-800">

        <p>
          Winnie and Frank are the deeply green world we grew up in, the context of our lives.
          They are walking Beatitudes, breathing. They continue to shape us. Mom is irreverent,
          funny while dad is quiet. Saintly is a word they both wear with ease and with humility.
          A genuine virtue. We came to be adults without any experience of the vulgar, without
          any understanding of the prideful. We never saw it in our home.
        </p>

        <p>
          Physically mom and dad were both beautiful. Stayed that way. Intellectually, they were
          off the charts. I don’t know the level of education reached by my dad. I am pretty sure
          that if he attended high school, he didn’t finish. On the farm his mom Agnes Mickens was
          losing her sight and daddy was her eyes. He had a photographic memory. We didn’t know
          this until we realized he knew all the phone numbers at Hallmark’s (at least one hundred)
          by heart. And what a heart it was/is. He gave this heart away first — and most
          comprehensively to mom.
        </p>

        <p>
          Mom held court at grandma’s dining room table and everyone craved a seat there. She had
          an uncanny ability to make people feel treasured. Mom would let me sit on her lap when I
          was full-grown and read poetry to her. She would laugh and tell me that I was adopted.
          She gave me her financial acumen by osmosis. Both mom and dad were engaged to someone
          else when they met, dad to Bernice and mom to Rudy. One of the GIs that came to grandma’s
          table said to my Ava Gardner mother: I know a man who could stay ahead of you. Mom said
          (brilliantly) that she would like to meet that man.
        </p>

        <p>
          Describing them is impossible. Think of the tenderest thing you know, think of
          unflagging attention and a bean soup almost too delicious to eat. They are the deeply
          green world we grew up in. They are walking Beatitudes. Breathing.
        </p>

      </div>
      </div>
    </AuthGuard>
  );
}

