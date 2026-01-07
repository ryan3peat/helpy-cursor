"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { Users, HeartHandshake } from "lucide-react";

export default function HomeContent() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-start">
        <motion.div
          className="flex-1 space-y-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            <Image
              src="/helpy-logo-text.png"
              alt="helpy"
              width={200}
              height={70}
              className="h-12 sm:h-14 lg:h-16 w-auto mb-2"
              priority
            />
            <span className="block mt-2 sm:mt-3">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold">
                The home management app that brings families and helpers closer.
              </span>
            </span>
          </h1>

          <div className="grid gap-5 sm:grid-cols-2 pt-2">
            <div className="rounded-2xl bg-card p-6 sm:p-8 shadow-soft hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-full bg-primary/10 p-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">For families</h3>
              </div>
              <p className="text-base text-muted-foreground leading-relaxed">
                Your all-in-one family task manager to
                keep meals, shared family tasks, and expenses in one calm, shared space.
              </p>
            </div>
            <div className="rounded-2xl bg-card p-6 sm:p-8 shadow-soft hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-full bg-primary/10 p-3">
                  <HeartHandshake className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">For helpers</h3>
              </div>
              <p className="text-base text-muted-foreground leading-relaxed">
                Clear routines, written in simple steps and in your language.
                This home helper app makes work feel poised and assured.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
            <a
              href="https://app.helpyfam.com"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors"
            >
              Get Started
            </a>
            <Link
              href="/features"
              className="inline-flex items-center justify-center rounded-full border border-primary bg-transparent px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              See All Features
            </Link>
          </div>

          <p className="hidden lg:block text-xs text-muted-foreground -mt-4">
            "I just want you to know I'm real grateful you're here"
            <br />
            Aibileen Clark, The Help
          </p>
        </motion.div>

        <motion.div
          className="w-full lg:flex-1 lg:pt-12"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="relative mx-auto max-w-xs sm:max-w-sm">
            {/* The "Glow" Image (Behind) */}
            <div className="absolute inset-0 translate-y-4 scale-95 opacity-60 blur-2xl">
              <Image
                src="/home-hero.jpg"
                alt=""
                fill
                className="object-cover rounded-3xl"
                aria-hidden="true"
              />
            </div>

            {/* The Main Image (Front) */}
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-secondary shadow-sm">
              <Image
                src="/home-hero.jpg"
                alt="Person using Helpy app on smartphone to manage household to-do lists and shopping tasks"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </motion.div>

        {/* Quote - Mobile only (appears at bottom after hero image) */}
        <motion.p 
          className="lg:hidden text-xs text-muted-foreground text-center w-full pt-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          "I just want you to know I'm real grateful you're here"
          <br />
          Aibileen Clark, The Help
        </motion.p>
      </section>
    </div>
  );
}

