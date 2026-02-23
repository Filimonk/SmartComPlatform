#include <greeting.hpp>

#include <userver/utest/utest.hpp>

using communicationservice::UserType;

UTEST(SayHelloTo, Basic) {
    EXPECT_EQ(communicationservice::SayHelloTo("Developer", UserType::kFirstTime), "Hello, Developer!\n");
    EXPECT_EQ(communicationservice::SayHelloTo({}, UserType::kFirstTime), "Hello, unknown user!\n");

    EXPECT_EQ(communicationservice::SayHelloTo("Developer", UserType::kKnown), "Hi again, Developer!\n");
    EXPECT_EQ(communicationservice::SayHelloTo({}, UserType::kKnown), "Hi again, unknown user!\n");
}